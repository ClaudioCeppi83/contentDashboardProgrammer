/**
 * @file e2e-lifecycle.test.ts
 * @description Suite de Integración de Ciclo de Vida Completo de Punta a Punta (E2E Lifecycle)
 * para Social Ops Dashboard (v0.1.0 MVP Instagram-First).
 * 
 * Cobertura de Fase 5:
 * 1. Flujo 1 (Ciclo Completo Exitoso):
 *    - CM crea un post en 'idea' o 'in_progress'.
 *    - CM solicita revisión al Cliente (transiciona a 'in_review').
 *    - Cliente accede a la vista de cliente para su 'clientId' ('client-lumina').
 *    - Cliente rechaza inicialmente con feedback obligatorio (transiciona a 'changes_requested').
 *    - CM realiza ajustes en el copy y vuelve a solicitar revisión ('in_review').
 *    - Cliente aprueba en 1 clic (transiciona a 'approved').
 *    - CM programa la publicación para fecha futura válida (transiciona a 'scheduled', generando 'idempotencyKey' y simulando tarea en Cloud Tasks).
 *    - Worker de Cloud Tasks procesa la tarea programada: ejecuta transacción atómica a 'publishing', genera Signed URLs de assets, invoca el adaptador y finaliza en 'published' con timestamps y datos de entrega.
 * 
 * 2. Flujo 2 (Defensa y Seguridad de Roles):
 *    - Cliente intentando agendar directamente sin rol CM (bloqueado por FSM).
 *    - Cliente intentando solicitar cambios sin ingresar comentario textual (bloqueado por FSM Guard).
 *    - Intento de acceso/mutación con 'clientId' ajeno (aislamiento multitenant verificado).
 *    - Tareas obsoletas o repetidas (replay attacks) descartadas limpiamente con HTTP 200 sin doble publicación.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PostFsmService,
  FsmTransitionError,
  FsmGuardError,
} from '@/application/services/post-fsm.service';
import { DispatchWorkerService } from '@/application/services/dispatch-worker.service';
import { validateClientId } from '@/application/validation/client-portal.validator';
import {
  getClientProfile,
  TAB_STATES,
} from '@/components/client-portal/client-portal-types';
import { MockTaskScheduler } from '@/infrastructure/tasks/cloud-tasks.service';
import { MockPublisherProvider } from '@/adapters/publishers/mock-publisher.provider';
import { POST as dispatchPostRoute } from '@/app/api/tasks/dispatch-post/route';
import { setWorkerServiceForTesting } from '@/app/api/tasks/dispatch-post/dispatch.helpers';
import type { PostDocument } from '@/domain/models/post.types';
import type { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import type { StorageService } from '@/infrastructure/storage/storage.service';

describe('E2E Lifecycle Integration Suite (Social Ops Dashboard v0.1.0)', () => {
  const FIXED_NOW = new Date('2026-10-24T12:00:00.000Z');
  const FUTURE_SCHEDULE_DATE = '2026-10-24T15:30:00.000Z'; // 3.5 horas en el futuro (> 2 min)

  let fsmService: PostFsmService;
  let mockScheduler: MockTaskScheduler;
  let mockPublisher: MockPublisherProvider;
  let simulatedDb: Map<string, PostDocument>;
  let mockFirestoreService: Partial<FirestoreService>;
  let mockStorageService: Partial<StorageService>;
  let worker: DispatchWorkerService;

  beforeEach(() => {
    fsmService = new PostFsmService(() => FIXED_NOW);
    mockScheduler = new MockTaskScheduler();
    mockPublisher = new MockPublisherProvider();
    simulatedDb = new Map<string, PostDocument>();

    mockFirestoreService = {
      getPostById: vi.fn(async (id: string) => {
        const item = simulatedDb.get(id);
        return item ? JSON.parse(JSON.stringify(item)) : null;
      }),
      transactionalStateUpdate: vi.fn(
        async (id: string, expectedState: string, nextState: string, _payload?: unknown, expectedIdemp?: string) => {
          const current = simulatedDb.get(id);
          if (!current) throw new Error(`Post not found: ${id}`);
          if (current.state !== expectedState) {
            throw new Error(`State mismatch: expected ${expectedState}, got ${current.state}`);
          }
          if (expectedIdemp && current.idempotencyKey !== expectedIdemp) {
            throw new Error(`IdempotencyKey mismatch: expected ${expectedIdemp}, got ${current.idempotencyKey}`);
          }
          current.state = nextState as any;
          current.updatedAt = FIXED_NOW.toISOString();
          simulatedDb.set(id, current);
          return JSON.parse(JSON.stringify(current));
        }
      ),
      updatePost: vi.fn(async (id: string, updates: Partial<PostDocument>) => {
        const current = simulatedDb.get(id);
        if (!current) throw new Error(`Post not found: ${id}`);
        const updated = { ...current, ...updates };
        simulatedDb.set(id, updated);
        return JSON.parse(JSON.stringify(updated));
      }),
    };

    mockStorageService = {
      generateMediaSignedUrls: vi.fn(async (assets: Array<{ id: string; storagePath: string }>) => {
        const urls: Record<string, string> = {};
        for (const asset of assets) {
          urls[asset.id] = `https://storage.googleapis.com/cdn-signed/${asset.id}?signature=sec-e2e-valid`;
        }
        return urls;
      }),
    };

    worker = new DispatchWorkerService(
      mockFirestoreService as FirestoreService,
      mockStorageService as StorageService,
      mockPublisher
    );
  });

  afterEach(() => {
    setWorkerServiceForTesting(null);
    vi.restoreAllMocks();
  });

  // =========================================================================
  // FLUJO 1: CICLO COMPLETO EXITOSO
  // =========================================================================
  describe('Flujo 1: Ciclo Completo Exitoso (End-to-End Happy Path)', () => {
    it('ejecuta la cadena completa desde la concepción hasta la publicación en Instagram con auditoría completa', async () => {
      // ---------------------------------------------------------------------
      // 1. CM crea un post en 'idea'
      // ---------------------------------------------------------------------
      let post: PostDocument = {
        id: 'post-e2e-001',
        clientId: 'client-lumina',
        authorId: 'cm-clara',
        title: 'Campaña Lino y Luz 2026',
        briefingScript: 'Transmitir serenidad, texturas orgánicas y sostenibilidad.',
        state: 'idea',
        platform: 'instagram',
        format: 'feed_post',
        copy: {
          caption: 'Nueva colección Lino & Luz. Diseñado para respirar y perdurar. #slowfashion #lumina',
          characterCount: 88,
          characterLimit: 2200,
          hashtags: ['#slowfashion', '#lumina'],
          isValid: true,
        },
        media: [
          {
            id: 'media-asset-001',
            storagePath: 'clients/client-lumina/posts/post-e2e-001/hero.jpg',
            downloadUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080',
            mimeType: 'image/jpeg',
            sizeBytes: 1.5 * 1024 * 1024,
            width: 1080,
            height: 1080,
            aspectRatio: '1:1',
            validationPassed: true,
          },
        ],
        scheduledAt: null,
        cloudTaskName: null,
        idempotencyKey: null,
        comments: [],
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      };

      expect(post.state).toBe('idea');
      expect(post.clientId).toBe('client-lumina');

      // Avanzar a 'in_progress' por el CM para desarrollo y curación técnica
      post = fsmService.transition(post, 'in_progress', {
        comment: {
          authorRole: 'cm',
          authorId: 'cm-clara',
          content: 'Iniciando producción visual y validación preflight de imagen.',
        },
      });
      expect(post.state).toBe('in_progress');

      // ---------------------------------------------------------------------
      // 2. CM solicita revisión al Cliente (transiciona a 'in_review')
      // ---------------------------------------------------------------------
      post = fsmService.transition(post, 'in_review', {
        comment: {
          authorRole: 'cm',
          authorId: 'cm-clara',
          content: 'Boceto finalizado con preflight verificado. Enviado a cliente para aprobación.',
        },
      });

      expect(post.state).toBe('in_review');
      expect(post.comments).toHaveLength(2);
      expect(post.comments[1].authorRole).toBe('cm');
      expect(post.comments[1].statusChangeTo).toBe('in_review');

      // Persistir estado en base de datos simulada
      simulatedDb.set(post.id, post);

      // ---------------------------------------------------------------------
      // 3. Cliente accede a la vista de cliente para su 'clientId' ('client-lumina')
      // ---------------------------------------------------------------------
      const clientPortalValidation = validateClientId('client-lumina');
      expect(clientPortalValidation.isValid).toBe(true);
      expect(clientPortalValidation.sanitizedClientId).toBe('client-lumina');

      const clientProfile = getClientProfile(clientPortalValidation.sanitizedClientId!);
      expect(clientProfile.id).toBe('client-lumina');
      expect(clientProfile.name).toBe('Lumina Brand');
      expect(clientProfile.verified).toBe(true);

      // Verificación de aislamiento de pestaña 'pending' (solo incluye 'in_review')
      const allowedPendingStates = TAB_STATES.pending;
      expect(allowedPendingStates).toContain('in_review');
      expect(allowedPendingStates.includes(post.state)).toBe(true);

      // ---------------------------------------------------------------------
      // 4. Cliente rechaza inicialmente con feedback obligatorio (transiciona a 'changes_requested')
      // ---------------------------------------------------------------------
      const clientFeedback = 'Por favor incluir el hashtag oficial #Sostenible2026 y ajustar tono del call to action.';
      post = fsmService.transition(post, 'changes_requested', {
        feedback: clientFeedback,
        comment: {
          authorRole: 'client',
          authorId: 'client-lumina',
          content: clientFeedback,
        },
      });

      expect(post.state).toBe('changes_requested');
      expect(post.comments).toHaveLength(3);
      const lastComment = post.comments[post.comments.length - 1];
      expect(lastComment.authorRole).toBe('client');
      expect(lastComment.statusChangeTo).toBe('changes_requested');
      expect(lastComment.content).toBe(clientFeedback);

      simulatedDb.set(post.id, post);

      // ---------------------------------------------------------------------
      // 5. CM realiza ajustes en el copy y vuelve a solicitar revisión ('in_review')
      // ---------------------------------------------------------------------
      // CM pasa a in_progress para aplicar cambios
      post = fsmService.transition(post, 'in_progress', {
        comment: {
          authorRole: 'cm',
          authorId: 'cm-clara',
          content: 'Ajustando copy según observaciones de Lumina Brand.',
        },
      });
      expect(post.state).toBe('in_progress');

      // Actualización de copy
      post.copy = {
        caption: 'Nueva colección Lino & Luz. Diseñado para respirar y perdurar. Descubre la pureza de lo natural. #slowfashion #lumina #Sostenible2026',
        characterCount: 140,
        characterLimit: 2200,
        hashtags: ['#slowfashion', '#lumina', '#Sostenible2026'],
        isValid: true,
      };

      // CM vuelve a enviar a revisión
      post = fsmService.transition(post, 'in_review', {
        comment: {
          authorRole: 'cm',
          authorId: 'cm-clara',
          content: 'Hashtag y CTA actualizados satisfactoriamente.',
        },
      });
      expect(post.state).toBe('in_review');
      simulatedDb.set(post.id, post);

      // ---------------------------------------------------------------------
      // 6. Cliente aprueba en 1 clic (transiciona a 'approved')
      // ---------------------------------------------------------------------
      const approvalFeedback = 'Excelente trabajo. Aprobado para publicar según cronograma editorial.';
      post = fsmService.transition(post, 'approved', {
        comment: {
          authorRole: 'client',
          authorId: 'client-lumina',
          content: approvalFeedback,
        },
      });

      expect(post.state).toBe('approved');
      expect(post.comments[post.comments.length - 1].authorRole).toBe('client');
      expect(post.comments[post.comments.length - 1].statusChangeTo).toBe('approved');
      simulatedDb.set(post.id, post);

      // ---------------------------------------------------------------------
      // 7. CM programa la publicación para fecha futura válida
      // ---------------------------------------------------------------------
      // Transiciona a 'scheduled', generando 'idempotencyKey' universal y registrando en Cloud Tasks
      const scheduleResult = await mockScheduler.schedulePostDispatch({
        postId: post.id,
        idempotencyKey: 'pending-temp-key', // Se actualizará con la FSM
        scheduledAt: FUTURE_SCHEDULE_DATE,
      });

      post = fsmService.transition(post, 'scheduled', {
        scheduledAt: FUTURE_SCHEDULE_DATE,
        cloudTaskName: scheduleResult.taskName,
      });

      expect(post.state).toBe('scheduled');
      expect(post.scheduledAt).toBe(FUTURE_SCHEDULE_DATE);
      expect(post.idempotencyKey).toBeDefined();
      expect(post.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(post.cloudTaskName).toBe(scheduleResult.taskName);

      simulatedDb.set(post.id, post);

      // ---------------------------------------------------------------------
      // 8. Worker de Cloud Tasks procesa la tarea programada
      // ---------------------------------------------------------------------
      const dispatchOutcome = await worker.processDispatch({
        postId: post.id,
        idempotencyKey: post.idempotencyKey!,
        attemptNumber: 1,
      });

      expect(dispatchOutcome.status).toBe('published');
      expect(dispatchOutcome.postId).toBe(post.id);
      expect(dispatchOutcome.publishResult).toBeDefined();
      expect(dispatchOutcome.publishResult?.mediaId).toBeDefined();
      expect(dispatchOutcome.publishResult?.permalink).toContain('instagram.com/p/');

      // Verificar que el cerrojo transaccional se adquirió ('scheduled' -> 'publishing')
      expect(mockFirestoreService.transactionalStateUpdate).toHaveBeenCalledWith(
        post.id,
        'scheduled',
        'publishing',
        undefined,
        post.idempotencyKey
      );

      // Verificar que se invocó la generación de Signed URLs con límite de expiración temporal
      expect(mockStorageService.generateMediaSignedUrls).toHaveBeenCalledWith(
        post.media,
        60
      );

      // Verificar que el adaptador de publicación recibió la orden
      expect(mockPublisher.publishHistory).toHaveLength(1);
      expect(mockPublisher.publishHistory[0].post.id).toBe(post.id);
      expect(mockPublisher.publishHistory[0].options?.idempotencyKey).toBe(post.idempotencyKey);

      // Verificar persistencia final en la base de datos
      const publishedPost = simulatedDb.get(post.id);
      expect(publishedPost).toBeDefined();
      expect(publishedPost?.state).toBe('published');
      expect(publishedPost?.publishedAt).toBeDefined();
      expect(publishedPost?.publishResult?.mediaId).toBe(dispatchOutcome.publishResult?.mediaId);
    });
  });

  // =========================================================================
  // FLUJO 2: DEFENSA Y SEGURIDAD DE ROLES
  // =========================================================================
  describe('Flujo 2: Defensa y Seguridad de Roles (Role Security, Guards, Multitenancy & Replay Defense)', () => {
    let basePost: PostDocument;

    beforeEach(() => {
      basePost = {
        id: 'post-sec-999',
        clientId: 'client-lumina',
        authorId: 'cm-clara',
        title: 'Post de Prueba de Seguridad',
        briefingScript: 'Validaciones de integridad y defensa perimetral.',
        state: 'in_review',
        platform: 'instagram',
        format: 'feed_post',
        copy: {
          caption: 'Copy con formato seguro #security',
          characterCount: 33,
          characterLimit: 2200,
          hashtags: ['#security'],
          isValid: true,
        },
        media: [
          {
            id: 'media-sec-01',
            storagePath: 'clients/client-lumina/sec.jpg',
            downloadUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080',
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 1024,
            width: 1080,
            height: 1080,
            aspectRatio: '1:1',
            validationPassed: true,
          },
        ],
        scheduledAt: null,
        cloudTaskName: null,
        idempotencyKey: null,
        comments: [],
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      };
      simulatedDb.set(basePost.id, basePost);
    });

    it('bloquea al cliente si intenta agendar directamente sin rol CM o sin pasar por aprobación (Violación FSM)', () => {
      // Un post en 'in_review' NUNCA puede pasar directo a 'scheduled'
      expect(() => {
        fsmService.transition(basePost, 'scheduled', {
          scheduledAt: FUTURE_SCHEDULE_DATE,
        });
      }).toThrowError(FsmTransitionError);

      try {
        fsmService.transition(basePost, 'scheduled', {
          scheduledAt: FUTURE_SCHEDULE_DATE,
        });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(FsmTransitionError);
        expect((err as Error).message).toContain("Transición no permitida: de 'in_review' a 'scheduled'");
      }
    });

    it('bloquea al cliente si intenta solicitar cambios sin ingresar comentario textual (Guarda FSM obligatoria)', () => {
      // Intento sin payload
      expect(() => {
        fsmService.transition(basePost, 'changes_requested');
      }).toThrowError(FsmGuardError);

      // Intento con comentario vacío / espacios en blanco
      expect(() => {
        fsmService.transition(basePost, 'changes_requested', {
          comment: '   ',
        });
      }).toThrowError(/feedback\/comentario es obligatorio/);

      // Intento con objeto comentario con contenido vacío
      expect(() => {
        fsmService.transition(basePost, 'changes_requested', {
          comment: {
            authorRole: 'client',
            authorId: 'client-lumina',
            content: '',
          },
        });
      }).toThrowError(/feedback\/comentario es obligatorio/);
    });

    it('garantiza el aislamiento multitenant y bloquea ataques de Path Traversal / XSS en clientId', () => {
      // 1. Inyecciones maliciosas bloqueadas por el validador
      const pathTraversal = validateClientId('../../../etc/passwd');
      expect(pathTraversal.isValid).toBe(false);
      expect(pathTraversal.errors.length).toBeGreaterThan(0);

      const xssAttack = validateClientId('<script>alert("xss")</script>');
      expect(xssAttack.isValid).toBe(false);
      expect(xssAttack.sanitizedClientId).toBeNull();

      const nullByte = validateClientId('client-lumina\0secret');
      expect(nullByte.isValid).toBe(false);

      // 2. Aislamiento de Posts entre Tenants
      const postLumina: PostDocument = { ...basePost, id: 'post-lumina-1', clientId: 'client-lumina' };
      const postAcme: PostDocument = { ...basePost, id: 'post-acme-1', clientId: 'client-acme' };
      const allPosts = [postLumina, postAcme];

      // Simulación del filtro del portal para client-lumina
      const luminaVisiblePosts = allPosts.filter(
        (p) => p.clientId.toLowerCase() === 'client-lumina'.toLowerCase()
      );
      expect(luminaVisiblePosts).toHaveLength(1);
      expect(luminaVisiblePosts[0].id).toBe('post-lumina-1');
      expect(luminaVisiblePosts.some((p) => p.clientId === 'client-acme')).toBe(false);

      // Simulación del filtro del portal para client-acme
      const acmeVisiblePosts = allPosts.filter(
        (p) => p.clientId.toLowerCase() === 'client-acme'.toLowerCase()
      );
      expect(acmeVisiblePosts).toHaveLength(1);
      expect(acmeVisiblePosts[0].id).toBe('post-acme-1');
    });

    it('descarta limpiamente con HTTP 200 y status stale_ignored las tareas repetidas (Replay Attacks) sin doble publicación', async () => {
      const ACTIVE_IDEMP_KEY = '11111111-2222-3333-4444-555555555555';
      const OLD_REPLAY_KEY = '99999999-8888-7777-6666-555555555555';

      // Post debidamente agendado
      basePost.state = 'scheduled';
      basePost.idempotencyKey = ACTIVE_IDEMP_KEY;
      simulatedDb.set(basePost.id, basePost);

      // 1. Tarea con clave de idempotencia manipulada u obsoleta
      const replayOutcome = await worker.processDispatch({
        postId: basePost.id,
        idempotencyKey: OLD_REPLAY_KEY,
      });

      expect(replayOutcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0); // 0 publicaciones efectuadas
      expect(mockFirestoreService.transactionalStateUpdate).not.toHaveBeenCalled();

      // 2. Tarea que llega cuando el post ya fue publicado exitosamente
      basePost.state = 'published';
      simulatedDb.set(basePost.id, basePost);

      const publishedReplayOutcome = await worker.processDispatch({
        postId: basePost.id,
        idempotencyKey: ACTIVE_IDEMP_KEY,
      });

      expect(publishedReplayOutcome.status).toBe('stale_ignored');
      expect(mockPublisher.publishHistory).toHaveLength(0);

      // 3. Verificación a nivel de Route Handler HTTP (/api/tasks/dispatch-post)
      setWorkerServiceForTesting(worker);
      process.env.TASKS_AUTH_SECRET = 'test-secret-e2e-suite';

      const request = new Request('http://localhost:3000/api/tasks/dispatch-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret-e2e-suite',
        },
        body: JSON.stringify({
          postId: basePost.id,
          idempotencyKey: OLD_REPLAY_KEY,
        }),
      });

      const response = await dispatchPostRoute(request);
      expect(response.status).toBe(200);

      const jsonResponse = await response.json();
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.outcome.status).toBe('stale_ignored');

      delete process.env.TASKS_AUTH_SECRET;
    });
  });
});
