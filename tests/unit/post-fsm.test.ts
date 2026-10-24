/**
 * @file post-fsm.test.ts
 * @description Suite de pruebas unitarias exhaustivas para la Máquina de Estados Finitos (FSM)
 * y validaciones pre-flight de posts de Instagram en Social Ops Dashboard.
 */

import { describe, it, expect } from 'vitest';
import {
  PostFsmService,
  FsmTransitionError,
  FsmGuardError,
} from '@/application/services/post-fsm.service';
import {
  VALID_POST_TRANSITIONS,
  type PostDocument,
  type PostState,
  type InstagramMediaAsset,
  type InstagramCopyData,
  type InstagramFormat,
} from '@/domain/models/post.types';

describe('PostFsmService - Certificación Forense FSM & Pre-flight', () => {
  const FIXED_NOW = new Date('2026-10-24T12:00:00.000Z');
  const service = new PostFsmService(() => FIXED_NOW);

  const ALL_STATES: readonly PostState[] = [
    'idea',
    'in_progress',
    'in_review',
    'changes_requested',
    'approved',
    'scheduled',
    'publishing',
    'published',
    'failed',
  ];

  // Asset y Copy canónicos válidos para Feed Post
  const validFeedImage: InstagramMediaAsset = {
    id: 'media-feed-1',
    storagePath: 'clients/c1/feed.jpg',
    downloadUrl: 'https://storage.googleapis.com/test/feed.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4 * 1024 * 1024, // 4 MB <= 8 MB
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    validationPassed: true,
  };

  const validReelVideo: InstagramMediaAsset = {
    id: 'media-reel-1',
    storagePath: 'clients/c1/reel.mp4',
    downloadUrl: 'https://storage.googleapis.com/test/reel.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 50 * 1024 * 1024, // 50 MB <= 100 MB
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    durationSeconds: 30, // 3s <= 30s <= 90s
    validationPassed: true,
  };

  const validCopy: InstagramCopyData = {
    caption: 'Gran lanzamiento de producto #marketing #social',
    characterCount: 47,
    characterLimit: 2200,
    hashtags: ['#marketing', '#social'],
    isValid: true,
  };

  function createTestPost(overrides: Partial<PostDocument> = {}): PostDocument {
    return {
      id: 'post-test-1',
      clientId: 'client-brand-1',
      authorId: 'cm-user-1',
      title: 'Campaña Primavera 2026',
      state: 'idea',
      platform: 'instagram',
      format: 'feed_post',
      copy: { ...validCopy },
      media: [{ ...validFeedImage }],
      comments: [],
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-24T10:00:00.000Z',
      ...overrides,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. MATRIZ COMPLETA DE TRANSICIONES (VÁLIDAS E INVÁLIDAS)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Matriz Canónica de Transiciones FSM', () => {
    describe('Transiciones Válidas Permitidas', () => {
      it('permite: idea -> in_progress', () => {
        const post = createTestPost({ state: 'idea' });
        const res = service.transition(post, 'in_progress');
        expect(res.state).toBe('in_progress');
        expect(res.updatedAt).toBe(FIXED_NOW.toISOString());
      });

      it('permite: in_progress -> in_review', () => {
        const post = createTestPost({ state: 'in_progress' });
        const res = service.transition(post, 'in_review');
        expect(res.state).toBe('in_review');
      });

      it('permite: in_review -> changes_requested (con feedback obligatorio)', () => {
        const post = createTestPost({ state: 'in_review' });
        const res = service.transition(post, 'changes_requested', {
          feedback: 'Por favor corregir el titular y hashtags.',
        });
        expect(res.state).toBe('changes_requested');
        expect(res.comments).toHaveLength(1);
        expect(res.comments[0].content).toBe('Por favor corregir el titular y hashtags.');
      });

      it('permite: in_review -> approved', () => {
        const post = createTestPost({ state: 'in_review' });
        const res = service.transition(post, 'approved');
        expect(res.state).toBe('approved');
      });

      it('permite: changes_requested -> in_progress', () => {
        const post = createTestPost({ state: 'changes_requested' });
        const res = service.transition(post, 'in_progress');
        expect(res.state).toBe('in_progress');
      });

      it('permite: approved -> in_progress', () => {
        const post = createTestPost({ state: 'approved' });
        const res = service.transition(post, 'in_progress');
        expect(res.state).toBe('in_progress');
      });

      it('permite: approved -> scheduled (con payload y guardas válidas)', () => {
        const post = createTestPost({ state: 'approved' });
        const scheduledTime = new Date(FIXED_NOW.getTime() + 15 * 60 * 1000).toISOString();
        const res = service.transition(post, 'scheduled', { scheduledAt: scheduledTime });
        expect(res.state).toBe('scheduled');
        expect(res.scheduledAt).toBe(scheduledTime);
      });

      it('permite: scheduled -> in_progress (des-agendamiento)', () => {
        const post = createTestPost({
          state: 'scheduled',
          scheduledAt: new Date(FIXED_NOW.getTime() + 30 * 60 * 1000).toISOString(),
          idempotencyKey: 'old-uuid-key',
        });
        const res = service.transition(post, 'in_progress');
        expect(res.state).toBe('in_progress');
      });

      it('permite: scheduled -> approved (cancelación a aprobado)', () => {
        const post = createTestPost({
          state: 'scheduled',
          scheduledAt: new Date(FIXED_NOW.getTime() + 30 * 60 * 1000).toISOString(),
          idempotencyKey: 'old-uuid-key',
        });
        const res = service.transition(post, 'approved');
        expect(res.state).toBe('approved');
      });

      it('permite: scheduled -> publishing', () => {
        const post = createTestPost({
          state: 'scheduled',
          scheduledAt: new Date(FIXED_NOW.getTime() + 30 * 60 * 1000).toISOString(),
          idempotencyKey: 'idemp-uuid-1',
        });
        const res = service.transition(post, 'publishing');
        expect(res.state).toBe('publishing');
      });

      it('permite: publishing -> published (estado terminal de éxito)', () => {
        const post = createTestPost({ state: 'publishing' });
        const res = service.transition(post, 'published', {
          publishResult: {
            mediaId: 'meta_ig_12345',
            permalink: 'https://instagram.com/p/test1234',
          },
        });
        expect(res.state).toBe('published');
        expect(res.publishedAt).toBe(FIXED_NOW.toISOString());
        expect(res.publishResult?.mediaId).toBe('meta_ig_12345');
      });

      it('permite: publishing -> failed (fallo de publicación)', () => {
        const post = createTestPost({ state: 'publishing' });
        const res = service.transition(post, 'failed', {
          publishResult: { error: 'Meta Graph API OAuth Exception 190' },
        });
        expect(res.state).toBe('failed');
        expect(res.publishResult?.error).toContain('Meta Graph API OAuth Exception 190');
      });

      it('permite: failed -> in_progress (reintento operativo)', () => {
        const post = createTestPost({ state: 'failed' });
        const res = service.transition(post, 'in_progress');
        expect(res.state).toBe('in_progress');
      });
    });

    describe('Transiciones Inválidas Específicas Requeridas', () => {
      it("rechaza intento ilegal: 'idea' -> 'scheduled'", () => {
        const post = createTestPost({ state: 'idea' });
        expect(() =>
          service.transition(post, 'scheduled', {
            scheduledAt: new Date(FIXED_NOW.getTime() + 10 * 60 * 1000).toISOString(),
          })
        ).toThrowError(FsmTransitionError);
      });

      it("rechaza intento ilegal: 'in_progress' -> 'published'", () => {
        const post = createTestPost({ state: 'in_progress' });
        expect(() => service.transition(post, 'published')).toThrowError(FsmTransitionError);
      });

      it("rechaza intento ilegal: 'published' -> 'idea'", () => {
        const post = createTestPost({ state: 'published' });
        expect(() => service.transition(post, 'idea')).toThrowError(FsmTransitionError);
      });

      it("rechaza cualquier transición que intente salir del estado terminal 'published'", () => {
        const publishedPost = createTestPost({ state: 'published' });
        for (const targetState of ALL_STATES) {
          expect(() => service.transition(publishedPost, targetState)).toThrowError(
            FsmTransitionError
          );
        }
      });
    });

    describe('Matriz Combinatoria Exhaustiva (81 combinaciones)', () => {
      ALL_STATES.forEach((currentState) => {
        const allowedTargets = VALID_POST_TRANSITIONS[currentState];
        const forbiddenTargets = ALL_STATES.filter((target) => !allowedTargets.includes(target));

        forbiddenTargets.forEach((targetState) => {
          it(`rechaza transición no autorizada: [${currentState}] -> [${targetState}]`, () => {
            const post = createTestPost({ state: currentState });
            expect(() =>
              service.transition(post, targetState, {
                scheduledAt: new Date(FIXED_NOW.getTime() + 10 * 60 * 1000).toISOString(),
                feedback: 'Feedback genérico de prueba',
              })
            ).toThrowError(FsmTransitionError);
          });
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GUARDAS ESTRICTAS DE AGENDAMIENTO ('approved' -> 'scheduled')
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Guardas de Agendamiento ('approved' -> 'scheduled')", () => {
    const validFutureScheduledAt = new Date(FIXED_NOW.getTime() + 10 * 60 * 1000).toISOString(); // +10 min

    describe('Validaciones Temporales y Buffer Mínimo (2 minutos)', () => {
      it('rechaza si scheduledAt no es proporcionado', () => {
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() => service.transition(approvedPost, 'scheduled')).toThrowError(FsmGuardError);
      });

      it('rechaza si scheduledAt tiene formato inválido de fecha', () => {
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: 'fecha-no-valida' })
        ).toThrowError(/Formato inválido de fecha/);
      });

      it('rechaza si scheduledAt está en el pasado (ej: hace 1 hora)', () => {
        const pastDate = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000).toISOString();
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: pastDate })
        ).toThrowError(/debe ser mayor a 2 minutos/);
      });

      it('rechaza si scheduledAt es exactamente la hora actual (now)', () => {
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: FIXED_NOW.toISOString() })
        ).toThrowError(/debe ser mayor a 2 minutos/);
      });

      it('rechaza si scheduledAt es menor a 2 minutos a futuro (ej: +60 seg)', () => {
        const nearFuture = new Date(FIXED_NOW.getTime() + 60 * 1000).toISOString();
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: nearFuture })
        ).toThrowError(/debe ser mayor a 2 minutos/);
      });

      it('rechaza en el límite exacto de 2 minutos (buffer <= 120,000 ms)', () => {
        const exactBoundary = new Date(FIXED_NOW.getTime() + 2 * 60 * 1000).toISOString();
        const approvedPost = createTestPost({ state: 'approved' });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: exactBoundary })
        ).toThrowError(/debe ser mayor a 2 minutos/);
      });

      it('acepta fecha superando estrictamente el umbral de 2 minutos (+121 seg)', () => {
        const validTime = new Date(FIXED_NOW.getTime() + 121 * 1000).toISOString();
        const approvedPost = createTestPost({ state: 'approved' });
        const result = service.transition(approvedPost, 'scheduled', { scheduledAt: validTime });
        expect(result.state).toBe('scheduled');
        expect(result.scheduledAt).toBe(validTime);
      });
    });

    describe('Generación Garantizada de idempotencyKey (UUIDv4)', () => {
      it('genera una clave idempotencyKey válida en formato UUIDv4 al agendar', () => {
        const approvedPost = createTestPost({ state: 'approved' });
        const result = service.transition(approvedPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });

        expect(result.idempotencyKey).toBeDefined();
        expect(typeof result.idempotencyKey).toBe('string');
        const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(result.idempotencyKey).toMatch(uuidv4Regex);
      });

      it('garantiza unicidad generando claves distintas en sucesivos agendamientos', () => {
        const approvedPost = createTestPost({ state: 'approved' });
        const res1 = service.transition(approvedPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        const res2 = service.transition(approvedPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });

        expect(res1.idempotencyKey).not.toBe(res2.idempotencyKey);
      });
    });

    describe('Guardas de Formato Reel', () => {
      const baseReelPost = createTestPost({
        state: 'approved',
        format: 'reel',
        media: [{ ...validReelVideo }],
      });

      it('acepta Reel válido (duración 30s, 50MB, ratio 9:16, video/mp4)', () => {
        const result = service.transition(baseReelPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it('rechaza Reel con duración < 3 segundos (ej: 2 seg)', () => {
        const invalidReel = {
          ...baseReelPost,
          media: [{ ...validReelVideo, durationSeconds: 2 }],
        };
        expect(() =>
          service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/duración de entre 3 y 90 segundos/);
      });

      it('rechaza Reel con duración > 90 segundos (ej: 91 seg)', () => {
        const invalidReel = {
          ...baseReelPost,
          media: [{ ...validReelVideo, durationSeconds: 91 }],
        };
        expect(() =>
          service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/duración de entre 3 y 90 segundos/);
      });

      it('rechaza Reel con duración indefinida', () => {
        const invalidReel = {
          ...baseReelPost,
          media: [{ ...validReelVideo, durationSeconds: undefined }],
        };
        expect(() =>
          service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/duración de entre 3 y 90 segundos/);
      });

      it('rechaza Reel con peso > 100 MB (ej: 101 MB)', () => {
        const invalidReel = {
          ...baseReelPost,
          media: [{ ...validReelVideo, sizeBytes: 101 * 1024 * 1024 }],
        };
        expect(() =>
          service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/no debe superar 100 MB/);
      });

      it("rechaza Reel con relación de aspecto distinta de '9:16' (ej: '1:1', '4:5', '16:9')", () => {
        const ratios = ['1:1', '4:5', '16:9'];
        for (const ratio of ratios) {
          const invalidReel = {
            ...baseReelPost,
            media: [{ ...validReelVideo, aspectRatio: ratio }],
          };
          expect(() =>
            service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
          ).toThrowError(/relación de aspecto 9:16/);
        }
      });

      it('rechaza Reel con mimeType no compatible (ej: image/png)', () => {
        const invalidReel = {
          ...baseReelPost,
          media: [{ ...validReelVideo, mimeType: 'image/png' as any }],
        };
        expect(() =>
          service.transition(invalidReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/formato video\/mp4/);
      });

      it('rechaza Reel si no contiene exactamente 1 asset multimedia', () => {
        const emptyReel = { ...baseReelPost, media: [] };
        expect(() =>
          service.transition(emptyReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/exactamente 1 asset multimedia/);

        const multiReel = { ...baseReelPost, media: [validReelVideo, validReelVideo] };
        expect(() =>
          service.transition(multiReel, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/exactamente 1 asset multimedia/);
      });
    });

    describe('Guardas de Formato Feed Post', () => {
      const baseFeedPost = createTestPost({
        state: 'approved',
        format: 'feed_post',
        media: [{ ...validFeedImage }],
      });

      it("acepta Feed Post con relación de aspecto '1:1'", () => {
        const result = service.transition(baseFeedPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it("acepta Feed Post con relación de aspecto '4:5'", () => {
        const portraitFeed = {
          ...baseFeedPost,
          media: [{ ...validFeedImage, aspectRatio: '4:5', height: 1350 }],
        };
        const result = service.transition(portraitFeed, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it('rechaza Feed Post con imagen > 8 MB (ej: 8.5 MB)', () => {
        const oversizedFeed = {
          ...baseFeedPost,
          media: [{ ...validFeedImage, sizeBytes: 8.5 * 1024 * 1024 }],
        };
        expect(() =>
          service.transition(oversizedFeed, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/no debe superar 8 MB/);
      });

      it("rechaza Feed Post con relación de aspecto no permitida (ej: '9:16' o '16:9')", () => {
        const wrongRatio = {
          ...baseFeedPost,
          media: [{ ...validFeedImage, aspectRatio: '9:16' }],
        };
        expect(() =>
          service.transition(wrongRatio, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/relación de aspecto 1:1 o 4:5/);
      });

      it('rechaza Feed Post con mimeType inválido (ej: video/mp4)', () => {
        const wrongMime = {
          ...baseFeedPost,
          media: [{ ...validFeedImage, mimeType: 'video/mp4' as any }],
        };
        expect(() =>
          service.transition(wrongMime, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/debe ser imagen JPEG o PNG/);
      });

      it('rechaza Feed Post con más de 1 imagen o sin imágenes', () => {
        const zeroMedia = { ...baseFeedPost, media: [] };
        expect(() =>
          service.transition(zeroMedia, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/exactamente 1 asset multimedia/);

        const twoMedia = { ...baseFeedPost, media: [validFeedImage, validFeedImage] };
        expect(() =>
          service.transition(twoMedia, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/exactamente 1 asset multimedia/);
      });
    });

    describe('Guardas de Formato Carousel', () => {
      const carouselItem1: InstagramMediaAsset = { ...validFeedImage, id: 'slide-1', aspectRatio: '1:1' };
      const carouselItem2: InstagramMediaAsset = { ...validFeedImage, id: 'slide-2', aspectRatio: '1:1' };
      const carouselItem3: InstagramMediaAsset = { ...validFeedImage, id: 'slide-3', aspectRatio: '1:1' };

      const baseCarouselPost = createTestPost({
        state: 'approved',
        format: 'carousel',
        media: [carouselItem1, carouselItem2, carouselItem3],
      });

      it('acepta carrusel válido con 3 imágenes con ratio uniforme 1:1', () => {
        const result = service.transition(baseCarouselPost, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it('acepta carrusel válido con 2 imágenes (mínimo permitido)', () => {
        const minCarousel = {
          ...baseCarouselPost,
          media: [carouselItem1, carouselItem2],
        };
        const result = service.transition(minCarousel, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it('acepta carrusel válido con 10 imágenes (máximo permitido)', () => {
        const maxCarouselMedia = Array.from({ length: 10 }, (_, i) => ({
          ...carouselItem1,
          id: `slide-${i + 1}`,
        }));
        const maxCarousel = { ...baseCarouselPost, media: maxCarouselMedia };
        const result = service.transition(maxCarousel, 'scheduled', {
          scheduledAt: validFutureScheduledAt,
        });
        expect(result.state).toBe('scheduled');
      });

      it('rechaza carrusel con menos de 2 imágenes (ej: 1 imagen)', () => {
        const underMin = { ...baseCarouselPost, media: [carouselItem1] };
        expect(() =>
          service.transition(underMin, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/entre 2 y 10 assets multimedia/);
      });

      it('rechaza carrusel con más de 10 imágenes (ej: 11 imágenes)', () => {
        const overMaxMedia = Array.from({ length: 11 }, (_, i) => ({
          ...carouselItem1,
          id: `slide-${i + 1}`,
        }));
        const overMax = { ...baseCarouselPost, media: overMaxMedia };
        expect(() =>
          service.transition(overMax, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/entre 2 y 10 assets multimedia/);
      });

      it('rechaza carrusel con ratios discordantes entre slides (slide 1 es 1:1, slide 2 es 4:5)', () => {
        const mixedRatioCarousel = {
          ...baseCarouselPost,
          media: [
            carouselItem1, // 1:1
            { ...carouselItem2, aspectRatio: '4:5' }, // 4:5 discordante
          ],
        };
        expect(() =>
          service.transition(mixedRatioCarousel, 'scheduled', {
            scheduledAt: validFutureScheduledAt,
          })
        ).toThrowError(/compartir el mismo ratio/);
      });

      it('rechaza carrusel con ratio no admitido como base (ej: 9:16)', () => {
        const wrongRatioCarousel = {
          ...baseCarouselPost,
          media: [
            { ...carouselItem1, aspectRatio: '9:16' },
            { ...carouselItem2, aspectRatio: '9:16' },
          ],
        };
        expect(() =>
          service.transition(wrongRatioCarousel, 'scheduled', {
            scheduledAt: validFutureScheduledAt,
          })
        ).toThrowError(/relación de aspecto 1:1 o 4:5/);
      });

      it('rechaza carrusel si algún slide individual supera 8 MB', () => {
        const heavySlideCarousel = {
          ...baseCarouselPost,
          media: [
            carouselItem1,
            { ...carouselItem2, sizeBytes: 9 * 1024 * 1024 }, // 9 MB
          ],
        };
        expect(() =>
          service.transition(heavySlideCarousel, 'scheduled', {
            scheduledAt: validFutureScheduledAt,
          })
        ).toThrowError(/supera el límite de 8 MB/);
      });
    });

    describe('Guardas de Copy y Textos de Instagram', () => {
      const approvedPost = createTestPost({ state: 'approved' });

      it('rechaza agendamiento si copy supera 2,200 caracteres', () => {
        const longCaption = 'x'.repeat(2201);
        const postWithLongCopy = {
          ...approvedPost,
          copy: {
            ...validCopy,
            caption: longCaption,
            characterCount: 2201,
          },
        };
        expect(() =>
          service.transition(postWithLongCopy, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/supera el límite de 2,200 caracteres/);
      });

      it('rechaza agendamiento si copy tiene isValid: false', () => {
        const postWithInvalidCopy = {
          ...approvedPost,
          copy: {
            ...validCopy,
            isValid: false,
          },
        };
        expect(() =>
          service.transition(postWithInvalidCopy, 'scheduled', {
            scheduledAt: validFutureScheduledAt,
          })
        ).toThrowError(/isValid: false/);
      });

      it('rechaza agendamiento si el objeto copy es undefined o null', () => {
        const postWithoutCopy = {
          ...approvedPost,
          copy: undefined as any,
        };
        expect(() =>
          service.transition(postWithoutCopy, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/copy no está definido/);
      });
    });

    describe('Guardas de Estado Técnico previo (validationPassed)', () => {
      it('rechaza agendamiento si algún asset tiene validationPassed: false', () => {
        const approvedPost = createTestPost({
          state: 'approved',
          media: [
            {
              ...validFeedImage,
              validationPassed: false,
              validationError: 'Error de integridad SHA256 o decodificación',
            },
          ],
        });
        expect(() =>
          service.transition(approvedPost, 'scheduled', { scheduledAt: validFutureScheduledAt })
        ).toThrowError(/no ha pasado la validación técnica previa/);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GUARDA DE FEEDBACK: in_review -> changes_requested
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Guarda de Feedback Obligatorio ('in_review' -> 'changes_requested')", () => {
    const inReviewPost = createTestPost({ state: 'in_review' });

    it('rechaza transición si no se provee ningún payload', () => {
      expect(() => service.transition(inReviewPost, 'changes_requested')).toThrowError(
        FsmGuardError
      );
    });

    it('rechaza transición si payload no contiene feedback ni comentario', () => {
      expect(() => service.transition(inReviewPost, 'changes_requested', {})).toThrowError(
        FsmGuardError
      );
    });

    it('rechaza transición si feedback es una cadena vacía o solo espacios en blanco', () => {
      expect(() =>
        service.transition(inReviewPost, 'changes_requested', { feedback: '' })
      ).toThrowError(FsmGuardError);
      expect(() =>
        service.transition(inReviewPost, 'changes_requested', { feedback: '    ' })
      ).toThrowError(FsmGuardError);
    });

    it('rechaza transición si comment es una cadena vacía o solo espacios en blanco', () => {
      expect(() =>
        service.transition(inReviewPost, 'changes_requested', { comment: '' })
      ).toThrowError(FsmGuardError);
      expect(() =>
        service.transition(inReviewPost, 'changes_requested', { comment: '    ' })
      ).toThrowError(FsmGuardError);
    });

    it('rechaza transición si comment es un objeto con content vacío o en blanco', () => {
      expect(() =>
        service.transition(inReviewPost, 'changes_requested', {
          comment: { content: '   ' },
        })
      ).toThrowError(FsmGuardError);
    });

    it("acepta transición con 'feedback' string y registra comentario con rol 'client'", () => {
      const feedbackText = 'Reemplazar imagen con la versión con logo blanco.';
      const res = service.transition(inReviewPost, 'changes_requested', {
        feedback: feedbackText,
      });

      expect(res.state).toBe('changes_requested');
      expect(res.comments).toHaveLength(1);
      const comment = res.comments[0];
      expect(comment.content).toBe(feedbackText);
      expect(comment.authorRole).toBe('client');
      expect(comment.statusChangeFrom).toBe('in_review');
      expect(comment.statusChangeTo).toBe('changes_requested');
      expect(comment.createdAt).toBe(FIXED_NOW.toISOString());
    });

    it("acepta transición con 'comment' string y preserva comentarios anteriores", () => {
      const postWithExistingComment = createTestPost({
        state: 'in_review',
        comments: [
          {
            id: 'c-prev',
            authorId: 'cm-1',
            authorRole: 'cm',
            content: 'Enviado a revisión inicial',
            createdAt: '2026-10-24T11:00:00.000Z',
          },
        ],
      });

      const res = service.transition(postWithExistingComment, 'changes_requested', {
        comment: 'Ajustar contraste en foto principal',
      });

      expect(res.comments).toHaveLength(2);
      expect(res.comments[0].id).toBe('c-prev');
      expect(res.comments[1].content).toBe('Ajustar contraste en foto principal');
      expect(res.comments[1].authorRole).toBe('client');
    });

    it('acepta transición con objeto TransitionCommentData personalizado', () => {
      const res = service.transition(inReviewPost, 'changes_requested', {
        comment: {
          id: 'custom-comment-id',
          authorId: 'user-client-director',
          authorRole: 'client',
          content: 'Cambio de última hora pedido por dirección.',
        },
      });

      expect(res.comments[0].id).toBe('custom-comment-id');
      expect(res.comments[0].authorId).toBe('user-client-director');
      expect(res.comments[0].content).toBe('Cambio de última hora pedido por dirección.');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CANCELACIÓN DE AGENDAMIENTO & CICLO DE VIDA DE IDEMPOTENCYKEY
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Cancelación de Agendamiento y Limpieza de Idempotencia', () => {
    const scheduledPost: PostDocument = createTestPost({
      state: 'scheduled',
      scheduledAt: new Date(FIXED_NOW.getTime() + 60 * 60 * 1000).toISOString(),
      idempotencyKey: 'active-uuid-idempotency-key',
      cloudTaskName: 'projects/alpha/locations/us-central1/queues/posts/tasks/task-99',
    });

    it("al pasar de 'scheduled' -> 'in_progress', limpia 'idempotencyKey' y 'cloudTaskName'", () => {
      const res = service.transition(scheduledPost, 'in_progress');
      expect(res.state).toBe('in_progress');
      expect(res.idempotencyKey).toBeNull();
      expect(res.cloudTaskName).toBeNull();
    });

    it("al pasar de 'scheduled' -> 'approved', limpia 'idempotencyKey' y 'cloudTaskName'", () => {
      const res = service.transition(scheduledPost, 'approved');
      expect(res.state).toBe('approved');
      expect(res.idempotencyKey).toBeNull();
      expect(res.cloudTaskName).toBeNull();
    });

    it("al pasar de 'scheduled' -> 'publishing', CONSERVA 'idempotencyKey' y 'cloudTaskName'", () => {
      const res = service.transition(scheduledPost, 'publishing');
      expect(res.state).toBe('publishing');
      expect(res.idempotencyKey).toBe('active-uuid-idempotency-key');
      expect(res.cloudTaskName).toBe(
        'projects/alpha/locations/us-central1/queues/posts/tasks/task-99'
      );
    });

    it("permite actualizar 'cloudTaskName' explícitamente en el payload si es enviado", () => {
      const res = service.transition(scheduledPost, 'publishing', {
        cloudTaskName: 'new-task-name',
      });
      expect(res.cloudTaskName).toBe('new-task-name');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PUBLICACIÓN Y ESTADOS TERMINALES
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Transiciones de Publicación y Recuperación', () => {
    const publishingPost: PostDocument = createTestPost({
      state: 'publishing',
      idempotencyKey: 'idemp-uuid-pub',
    });

    it("transiciona de 'publishing' -> 'published' registrando publishedAt y publishResult", () => {
      const res = service.transition(publishingPost, 'published', {
        publishResult: {
          mediaContainerId: 'container-123',
          mediaId: 'instagram-media-777',
          permalink: 'https://instagram.com/p/publishedPost',
        },
      });

      expect(res.state).toBe('published');
      expect(res.publishedAt).toBe(FIXED_NOW.toISOString());
      expect(res.publishResult?.mediaId).toBe('instagram-media-777');
      expect(res.publishResult?.permalink).toBe('https://instagram.com/p/publishedPost');
    });

    it("permite especificar un 'publishedAt' personalizado en el payload", () => {
      const customPublishedAt = '2026-10-24T12:05:00.000Z';
      const res = service.transition(publishingPost, 'published', {
        publishedAt: customPublishedAt,
        publishResult: { mediaId: 'id-1' },
      });

      expect(res.publishedAt).toBe(customPublishedAt);
    });

    it("transiciona de 'publishing' -> 'failed' registrando el error de la API", () => {
      const res = service.transition(publishingPost, 'failed', {
        publishResult: {
          error: 'Instagram API Error 36003: Aspect ratio not supported for this media type.',
        },
      });

      expect(res.state).toBe('failed');
      expect(res.publishResult?.error).toContain('Instagram API Error 36003');
    });

    it("permite reintento operativo de 'failed' -> 'in_progress'", () => {
      const failedPost = createTestPost({
        state: 'failed',
        publishResult: { error: 'Temporary connection timeout' },
      });
      const res = service.transition(failedPost, 'in_progress');
      expect(res.state).toBe('in_progress');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. INMUTABILIDAD Y GESTIÓN DE TIMESTAMPS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Inmutabilidad y Preservación de Datos', () => {
    it('no muta el objeto PostDocument de entrada (pureza funcional)', () => {
      const originalPost = createTestPost({ state: 'idea' });
      const originalSnapshot = JSON.parse(JSON.stringify(originalPost));

      const updated = service.transition(originalPost, 'in_progress');

      expect(originalPost.state).toBe('idea');
      expect(originalPost).toEqual(originalSnapshot);
      expect(updated).not.toBe(originalPost);
    });

    it('actualiza updatedAt en cada transición al timestamp provisto por nowProvider', () => {
      const post = createTestPost({ state: 'idea', updatedAt: '2026-10-01T00:00:00.000Z' });
      const updated = service.transition(post, 'in_progress');
      expect(updated.updatedAt).toBe(FIXED_NOW.toISOString());
    });
  });
});
