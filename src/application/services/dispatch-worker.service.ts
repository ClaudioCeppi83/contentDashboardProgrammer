/**
 * @file dispatch-worker.service.ts
 * @description Servicio de aplicación que orquesta el despacho seguro e idempotente de publicaciones.
 * Mitiga Replay Attacks y Doble Despacho mediante verificación atómica de idempotencyKey en Firestore.
 */

import type { PostDocument, PostPublishResult, PostComment } from '@/domain/models/post.types';
import type { SocialPublisherAdapter, PublishResult } from '@/domain/adapters/social-publisher.interface';
import type { StorageService } from '@/infrastructure/storage/storage.service';
import type { FirestoreService } from '@/infrastructure/firebase/firestore.service';

export class TransientDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientDispatchError';
  }
}

export interface DispatchTaskPayload {
  postId: string;
  idempotencyKey: string;
  attemptNumber?: number;
}

export type DispatchOutcomeStatus =
  | 'published'
  | 'stale_ignored'
  | 'failed_terminal';

export interface DispatchOutcome {
  status: DispatchOutcomeStatus;
  postId: string;
  message?: string;
  publishResult?: PostPublishResult;
}

export class DispatchWorkerService {
  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly storageService: StorageService,
    private readonly publisher: SocialPublisherAdapter
  ) {}

  /**
   * Ejecuta el despacho seguro e idempotente del post agendado.
   */
  async processDispatch(payload: DispatchTaskPayload): Promise<DispatchOutcome> {
    const { postId, idempotencyKey, attemptNumber = 0 } = payload;

    // 1. Verificación inicial de existencia
    const post = await this.firestoreService.getPostById(postId);
    if (!post) {
      return {
        status: 'stale_ignored',
        postId,
        message: `Post ${postId} no existe en Firestore. Tarea descartada de forma idempotente.`,
      };
    }

    // 2. Comprobación preliminar de idempotencia para descarte rápido
    if (post.state !== 'scheduled' || post.idempotencyKey !== idempotencyKey) {
      return {
        status: 'stale_ignored',
        postId,
        message: `Tarea obsoleta o clave de idempotencia caducada para post ${postId} (estado: ${post.state}). Descartada.`,
      };
    }

    // 3. Cerrojo Transaccional Atómico en Firestore: Transición de 'scheduled' a 'publishing'
    let lockedPost: PostDocument;
    try {
      lockedPost = await this.firestoreService.transactionalStateUpdate(
        postId,
        'scheduled',
        'publishing',
        undefined,
        idempotencyKey
      );
    } catch {
      // Si la transacción falla por contención o cambio de estado concorrente, descartamos
      return {
        status: 'stale_ignored',
        postId,
        message: `Conflicto transaccional al adquirir el cerrojo de despacho para post ${postId}. Tarea ignorada.`,
      };
    }

    // 4. Generación de Signed URLs temporales (Mínimo Privilegio Temporal <= 60 min)
    let signedUrls: Record<string, string> = {};
    if (lockedPost.media && lockedPost.media.length > 0) {
      try {
        signedUrls = await this.storageService.generateMediaSignedUrls(lockedPost.media, 60);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido al generar Signed URLs';
        await this.handleTerminalFailure(lockedPost, `Fallo en generación de Signed URLs: ${errorMsg}`);
        return {
          status: 'failed_terminal',
          postId,
          message: errorMsg,
        };
      }
    }

    // 5. Invocación de publicación hacia el adaptador (puerto secundario)
    let publishResult: PublishResult;
    try {
      publishResult = await this.publisher.publish(lockedPost, {
        signedUrls,
        idempotencyKey,
        attemptNumber,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error no controlado durante la publicación';
      publishResult = {
        success: false,
        error: errorMsg,
        isTransientError: true, // Asumimos transitorio ante caídas imprevistas de red
      };
    }

    // 6. Manejo de Éxito
    if (publishResult.success) {
      const nowIso = new Date().toISOString();
      const finalResult: PostPublishResult = {
        mediaId: publishResult.platformPostId,
        permalink: publishResult.permalink,
        mediaContainerId: publishResult.mediaContainerId,
      };

      await this.firestoreService.updatePost(postId, {
        state: 'published',
        publishedAt: nowIso,
        publishResult: finalResult,
        updatedAt: nowIso,
      });

      return {
        status: 'published',
        postId,
        publishResult: finalResult,
      };
    }

    // 7. Manejo de Errores: Transitorios vs Terminales
    if (publishResult.isTransientError) {
      // Revertimos a 'scheduled' para permitir el reintento de Cloud Tasks con backoff exponencial
      await this.firestoreService.updatePost(postId, {
        state: 'scheduled',
        updatedAt: new Date().toISOString(),
      });

      throw new TransientDispatchError(
        `Fallo transitorio en publicación de post ${postId}: ${publishResult.error || 'Desconocido'}`
      );
    }

    // Fallo irrecuperable (terminal)
    await this.handleTerminalFailure(
      lockedPost,
      publishResult.error || 'Error fatal no recuperable en red social'
    );

    return {
      status: 'failed_terminal',
      postId,
      message: publishResult.error,
    };
  }

  private async handleTerminalFailure(post: PostDocument, errorMessage: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const systemComment: PostComment = {
      id: `sys-${Date.now()}`,
      authorId: 'system-worker',
      authorRole: 'system',
      content: `Fallo irreversible en despacho: ${errorMessage}`,
      createdAt: nowIso,
      statusChangeFrom: 'publishing',
      statusChangeTo: 'failed',
    };

    await this.firestoreService.updatePost(post.id, {
      state: 'failed',
      publishResult: {
        error: errorMessage,
      },
      comments: [...post.comments, systemComment],
      updatedAt: nowIso,
    });
  }
}
