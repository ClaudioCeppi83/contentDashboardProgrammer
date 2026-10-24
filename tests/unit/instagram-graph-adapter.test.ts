/**
 * @file instagram-graph-adapter.test.ts
 * @description Suite de pruebas unitarias para InstagramGraphAdapter y el clasificador de errores de Meta.
 * Valida creación de contenedores, polling asíncrono de video, carruseles, firstComment y discriminación de errores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstagramGraphAdapter } from '@/adapters/publishers/instagram-graph.adapter';
import { classifyMetaGraphError } from '@/adapters/publishers/instagram-error.classifier';
import type { PostDocument } from '@/domain/models/post.types';

describe('InstagramGraphAdapter & Meta Error Classifier Tests', () => {
  const sampleImagePost: PostDocument = {
    id: 'post-ig-1',
    clientId: 'client-agency',
    authorId: 'cm-1',
    title: 'Post Feed Imagen',
    state: 'publishing',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Descubre nuestra nueva colección de verano #summer #fashion',
      characterCount: 60,
      characterLimit: 2200,
      hashtags: ['summer', 'fashion'],
      firstComment: 'Encuentra el enlace en nuestra bio',
      isValid: true,
    },
    media: [
      {
        id: 'asset-img-1',
        storagePath: 'media/post-ig-1/image.jpg',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/image.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1048576,
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        validationPassed: true,
      },
    ],
    comments: [],
    createdAt: '2026-10-24T10:00:00.000Z',
    updatedAt: '2026-10-24T10:00:00.000Z',
  };

  const sampleVideoPost: PostDocument = {
    ...sampleImagePost,
    id: 'post-ig-video',
    format: 'reel',
    media: [
      {
        id: 'asset-video-1',
        storagePath: 'media/post-ig-video/reel.mp4',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/reel.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 15728640,
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        durationSeconds: 15,
        validationPassed: true,
      },
    ],
  };

  const sampleCarouselPost: PostDocument = {
    ...sampleImagePost,
    id: 'post-ig-carousel',
    format: 'carousel',
    media: [
      {
        id: 'asset-c1',
        storagePath: 'media/post-ig-carousel/slide1.jpg',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/slide1.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 500000,
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        validationPassed: true,
      },
      {
        id: 'asset-c2',
        storagePath: 'media/post-ig-carousel/slide2.jpg',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/slide2.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 600000,
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        validationPassed: true,
      },
    ],
  };

  describe('1. Preflight Validation', () => {
    it('valida exitosamente un post conforme con las especificaciones de Instagram', async () => {
      const adapter = new InstagramGraphAdapter();
      const result = await adapter.validatePreflight(sampleImagePost);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detecta errores de preflight si el copy excede el límite de 2,200 caracteres', async () => {
      const adapter = new InstagramGraphAdapter();
      const invalidPost: PostDocument = {
        ...sampleImagePost,
        copy: {
          ...sampleImagePost.copy,
          caption: 'a'.repeat(2205),
          characterCount: 2205,
          isValid: false,
        },
      };

      const result = await adapter.validatePreflight(invalidPost);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('2,200'))).toBe(true);
    });
  });

  describe('2. Publicación de Imagen Individual (Feed Post)', () => {
    it('crea contenedor, publica y postea firstComment con éxito', async () => {
      const calls: Array<{ url: string; method: string; body?: string }> = [];

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';
        const body = init?.body ? init.body.toString() : undefined;
        calls.push({ url: urlStr, method, body });

        if (urlStr.endsWith('/1784140000/media') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'container-img-999' }), { status: 200 });
        }
        if (urlStr.endsWith('/1784140000/media_publish') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'ig-media-post-888' }), { status: 200 });
        }
        if (urlStr.includes('/ig-media-post-888?fields=permalink')) {
          return new Response(
            JSON.stringify({ permalink: 'https://www.instagram.com/p/Cxyz123/' }),
            { status: 200 }
          );
        }
        if (urlStr.endsWith('/ig-media-post-888/comments') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'comment-111' }), { status: 200 });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      });

      const adapter = new InstagramGraphAdapter({
        accountId: '1784140000',
        accessToken: 'EAAB_test_token',
        fetchFn: mockFetch as any,
      });

      const result = await adapter.publish(sampleImagePost, {
        signedUrls: { 'asset-img-1': 'https://storage.googleapis.com/signed/img.jpg' },
      });

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig-media-post-888');
      expect(result.mediaContainerId).toBe('container-img-999');
      expect(result.permalink).toBe('https://www.instagram.com/p/Cxyz123/');

      // Verificar que se utilizó la Signed URL
      const mediaCall = calls.find((c) => c.url.endsWith('/media'));
      expect(mediaCall?.body).toContain('signed%2Fimg.jpg');
    });
  });

  describe('3. Publicación de Video / Reel con Polling de Contenedor', () => {
    it('ejecuta polling de status_code hasta recibir FINISHED antes de publicar', async () => {
      let pollCount = 0;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';

        if (urlStr.endsWith('/1784140000/media') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'container-video-100' }), { status: 200 });
        }

        if (urlStr.includes('/container-video-100?fields=status_code') && method === 'GET') {
          pollCount++;
          if (pollCount === 1) {
            return new Response(JSON.stringify({ status_code: 'IN_PROGRESS' }), { status: 200 });
          }
          return new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 });
        }

        if (urlStr.endsWith('/1784140000/media_publish') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'ig-reel-777' }), { status: 200 });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      });

      const adapter = new InstagramGraphAdapter({
        accountId: '1784140000',
        accessToken: 'EAAB_test_token',
        fetchFn: mockFetch as any,
        pollIntervalMs: 5,
        maxPollAttempts: 5,
      });

      const result = await adapter.publish(sampleVideoPost);

      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig-reel-777');
      expect(pollCount).toBe(2);
    });

    it('falla si el contenedor de video retorna estado ERROR en el polling', async () => {
      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';

        if (urlStr.endsWith('/1784140000/media') && method === 'POST') {
          return new Response(JSON.stringify({ id: 'container-bad-video' }), { status: 200 });
        }

        if (urlStr.includes('/container-bad-video?fields=status_code')) {
          return new Response(JSON.stringify({ status_code: 'ERROR' }), { status: 200 });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      });

      const adapter = new InstagramGraphAdapter({
        accountId: '1784140000',
        accessToken: 'EAAB_test_token',
        fetchFn: mockFetch as any,
        pollIntervalMs: 5,
      });

      const result = await adapter.publish(sampleVideoPost);
      expect(result.success).toBe(false);
      expect(result.error).toContain("falló con estado 'ERROR'");
    });
  });

  describe('4. Publicación de Carrusel Multi-Asset', () => {
    it('crea los contenedores individuales con is_carousel_item y luego el contenedor padre', async () => {
      const calls: string[] = [];

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        const method = init?.method || 'GET';
        const body = init?.body ? init.body.toString() : '';

        if (urlStr.endsWith('/1784140000/media') && method === 'POST') {
          if (body.includes('is_carousel_item=true')) {
            const count = calls.filter((c) => c === 'child').length + 1;
            calls.push('child');
            return new Response(JSON.stringify({ id: `child-container-${count}` }), {
              status: 200,
            });
          }
          if (body.includes('media_type=CAROUSEL')) {
            calls.push('parent');
            expect(body).toContain('children=child-container-1%2Cchild-container-2');
            return new Response(JSON.stringify({ id: 'parent-carousel-container' }), {
              status: 200,
            });
          }
        }

        if (urlStr.endsWith('/1784140000/media_publish') && method === 'POST') {
          expect(body).toContain('creation_id=parent-carousel-container');
          return new Response(JSON.stringify({ id: 'ig-carousel-post-555' }), { status: 200 });
        }

        return new Response(JSON.stringify({}), { status: 200 });
      });

      const adapter = new InstagramGraphAdapter({
        accountId: '1784140000',
        accessToken: 'EAAB_test_token',
        fetchFn: mockFetch as any,
      });

      const result = await adapter.publish(sampleCarouselPost);
      expect(result.success).toBe(true);
      expect(result.platformPostId).toBe('ig-carousel-post-555');
      expect(calls).toEqual(['child', 'child', 'parent']);
    });
  });

  describe('5. Clasificador de Errores: Transitorios vs Terminales', () => {
    it('marca errores de Rate Limit (HTTP 429) como transitorios', () => {
      const res = classifyMetaGraphError(null, 429, {
        error: { message: 'Calls limit reached', code: 4 },
      });

      expect(res.isTransient).toBe(true);
      expect(res.message).toContain('error transitorio');
    });

    it('marca errores de token revocado (código 190 / HTTP 401) como terminales', () => {
      const res = classifyMetaGraphError(null, 401, {
        error: { message: 'Error validating access token', code: 190 },
      });

      expect(res.isTransient).toBe(false);
      expect(res.message).toContain('error fatal');
    });

    it('marca fallos de red por timeout o AbortError como transitorios', () => {
      const timeoutErr = new Error('The operation was aborted');
      timeoutErr.name = 'AbortError';

      const res = classifyMetaGraphError(timeoutErr);
      expect(res.isTransient).toBe(true);
      expect(res.message).toContain('conectividad de red');
    });

    it('retorna error terminal inmediato si faltan credenciales configuradas', async () => {
      const adapter = new InstagramGraphAdapter({
        accountId: '',
        accessToken: '',
      });

      const result = await adapter.publish(sampleImagePost);
      expect(result.success).toBe(false);
      expect(result.isTransientError).toBe(false);
      expect(result.error).toContain('Credenciales');
    });
  });
});
