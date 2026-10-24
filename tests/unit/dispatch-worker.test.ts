/**
 * @file dispatch-worker.test.ts
 * @description Suite de pruebas unitarias de seguridad para DispatchWorkerService.
 * Valida la mitigación contra Replay Attacks, prevención de Doble Despacho mediante
 * cerrojo transaccional atómico e idempotencia frente a tareas desincronizadas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DispatchWorkerService,
  TransientDispatchError,
} from '@/application/services/dispatch-worker.service';
import { StorageService } from '@/infrastructure/storage/storage.service';
import { MockPublisherProvider } from '@/adapters/publishers/mock-publisher.provider';
import type { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import type { PostDocument } from '@/domain/models/post.types';

describe('DispatchWorkerService Security & Idempotency Tests', () => {
  let mockFirestoreService: any;
  let mockStorageService: any;
  let mockPublisher: MockPublisherProvider;
  let worker: DispatchWorkerService;
  let sampleScheduledPost: PostDocument;

  const TEST_IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000';
  const OTHER_IDEMPOTENCY_KEY = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  beforeEach(() => {
    sampleScheduledPost = {
      id: 'post-100',
      clientId: 'client-cyber',
      authorId: 'cm-1',
      title: 'Post Seguro',
      state: 'scheduled',
      platform: 'instagram',
      format: 'feed_post',
      copy: {
        caption: 'Seguridad en Cloud Tasks #security',
        characterCount: 35,
        characterLimit: 2200,
        hashtags: ['security'],
        isValid: true,
      },
      media: [
        {
          id: 'asset-1',
          storagePath: 'media/post-100/feed.jpg',
          downloadUrl: '',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          width: 1080,
          height: 1080,
          aspectRatio: '1:1',
          validationPassed: true,
        },
      ],
      scheduledAt: '2026-10-24T20:00:00.000Z',
      idempotencyKey: TEST_IDEMPOTENCY_KEY,
      comments: [],
      createdAt: '2026-10-24T18:00:00.000Z',
      updatedAt: '2026-10-24T18:00:00.000Z',
    };

    mockFirestoreService = {
      getPostById: vi.fn(async (id: string) => {
        if (id === 'post-100') return { ...sampleScheduledPost };
        return null;
      }),
      transactionalStateUpdate: vi.fn(
        async (id: string, expectedState: string, nextState: string, _payload: any, expectedIdemp: string) => {
          if (sampleScheduledPost.state !== expectedState) {
            throw new Error(`State mismatch: expected ${expectedState}, got ${sampleScheduledPost.state}`);
          }
          if (sampleScheduledPost.idempotencyKey !== expectedIdemp) {
            throw new Error('IdempotencyKey mismatch');
          }
          sampleScheduledPost.state = nextState as any;
          return { ...sampleScheduledPost };
        }
      ),
      updatePost: vi.fn(async (id: string, updates: any) => {
        sampleScheduledPost = { ...sampleScheduledPost, ...updates };
        return sampleScheduledPost;
      }),
    };

    mockStorageService = {
      generateMediaSignedUrls: vi.fn(async (assets: any[]) => {
        return { [assets[0].id]: 'https://storage.googleapis.com/signed-read-url' };
      }),
    };

    mockPublisher = new MockPublisherProvider();
    worker = new DispatchWorkerService(
      mockFirestoreService as unknown as FirestoreService,
      mockStorageService as unknown as StorageService,
      mockPublisher
    );
  });

  describe('1. Mitigación de Replay Attacks y Tareas Obsoletas', () => {
    it('ignora de forma idempotente tareas con idempotencyKey obsoleta o manipulada', async () => {
      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: OTHER_IDEMPOTENCY_KEY, // Clave distinta (ej. tarea reprogramada anterior)
      });

      expect(outcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0); // Cero llamadas a Meta
      expect(mockFirestoreService.transactionalStateUpdate).not.toHaveBeenCalled();
    });

    it('ignora tareas cuando el post ya está en estado "published" (Replay Attack)', async () => {
      sampleScheduledPost.state = 'published';

      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(outcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0);
    });

    it('ignora tareas cuando el post está en estado "in_review" o "in_progress" (Des-agendado)', async () => {
      sampleScheduledPost.state = 'in_progress';

      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(outcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0);
    });

    it('ignora tareas para posts inexistentes sin fallar', async () => {
      const outcome = await worker.processDispatch({
        postId: 'post-999',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(outcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0);
    });
  });

  describe('2. Prevención de Doble Despacho mediante Cerrojo Transaccional', () => {
    it('adquiere cerrojo atómico "publishing" en Firestore antes de invocar la red social', async () => {
      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(mockFirestoreService.transactionalStateUpdate).toHaveBeenCalledWith(
        'post-100',
        'scheduled',
        'publishing',
        undefined,
        TEST_IDEMPOTENCY_KEY
      );
      expect(outcome.status).toBe('published');
      expect(sampleScheduledPost.state).toBe('published');
    });

    it('bloquea la segunda invocación si dos workers compiten concurrentemente', async () => {
      // Simulamos que otro worker concurrentemente ya cambió el estado a 'publishing'
      mockFirestoreService.transactionalStateUpdate.mockRejectedValueOnce(
        new Error('Transaction contention: State mismatch')
      );

      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(outcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0); // No publica dos veces
    });
  });

  describe('3. Manejo de Fallos: Transitorios (HTTP 503) vs Terminales (HTTP 200)', () => {
    it('ante error transitorio (ej. Meta 429 o timeout), restaura estado "scheduled" y arroja TransientDispatchError', async () => {
      mockPublisher.shouldFail = true;
      mockPublisher.isTransientError = true;
      mockPublisher.failureMessage = 'Meta Rate Limit Exceeded (429)';

      await expect(
        worker.processDispatch({
          postId: 'post-100',
          idempotencyKey: TEST_IDEMPOTENCY_KEY,
        })
      ).rejects.toThrowError(TransientDispatchError);

      expect(sampleScheduledPost.state).toBe('scheduled'); // Revertido para reintento de Cloud Tasks
    });

    it('ante error terminal (ej. token revocado), transiciona a "failed", registra comentario y finaliza', async () => {
      mockPublisher.shouldFail = true;
      mockPublisher.isTransientError = false;
      mockPublisher.failureMessage = 'OAuthException: User token has been revoked';

      const outcome = await worker.processDispatch({
        postId: 'post-100',
        idempotencyKey: TEST_IDEMPOTENCY_KEY,
      });

      expect(outcome.status).toBe('failed_terminal');
      expect(sampleScheduledPost.state).toBe('failed');
      expect(sampleScheduledPost.publishResult?.error).toContain('revoked');
      expect(sampleScheduledPost.comments.some((c) => c.authorRole === 'system')).toBe(true);
    });
  });
});
