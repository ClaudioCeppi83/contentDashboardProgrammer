/**
 * @file dispatch-route.test.ts
 * @description Suite de pruebas unitarias para el endpoint HTTP /api/tasks/dispatch-post.
 * Certifica autenticación OIDC/Bearer, inmunidad a Parameter Tampering, códigos HTTP y supresión de Stack Traces.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  POST,
  setWorkerServiceForTesting,
  timingSafeCompare,
} from '@/app/api/tasks/dispatch-post/route';
import {
  DispatchWorkerService,
  TransientDispatchError,
} from '@/application/services/dispatch-worker.service';

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(function () {
      return {
        verifyIdToken: vi.fn(async ({ idToken }: { idToken: string }) => {
          if (idToken === 'valid-google-oidc-jwt.payload.signature') {
            return {
              getPayload: () => ({
                iss: 'https://accounts.google.com',
                email: 'cloud-tasks@gcp-sa.iam.gserviceaccount.com',
                sub: '1234567890',
              }),
            };
          }
          throw new Error('Invalid OIDC signature');
        }),
      };
    }),
  };
});

describe('Route Handler POST /api/tasks/dispatch-post Security Tests', () => {
  const VALID_SECRET = 'super-secret-task-bearer-key-12345';
  const VALID_IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000';
  let mockWorker: any;

  beforeEach(() => {
    process.env.TASKS_AUTH_SECRET = VALID_SECRET;

    mockWorker = {
      processDispatch: vi.fn(async (payload: any) => ({
        status: 'published',
        postId: payload.postId,
        publishResult: { mediaId: 'mock-123' },
      })),
    };
    setWorkerServiceForTesting(mockWorker as unknown as DispatchWorkerService);
  });

  afterEach(() => {
    delete process.env.TASKS_AUTH_SECRET;
    setWorkerServiceForTesting(null);
  });

  const createRequest = (options: {
    headers?: Record<string, string>;
    body?: any;
    rawBody?: string;
  }) => {
    const headers = new Headers(options.headers || {});
    const bodyStr = options.rawBody !== undefined ? options.rawBody : JSON.stringify(options.body ?? {});

    return new Request('https://app.socialops.internal/api/tasks/dispatch-post', {
      method: 'POST',
      headers,
      body: bodyStr,
    });
  };

  describe('1. Verificación Estricta de Autenticación (Bearer & OIDC)', () => {
    it('rechaza peticiones sin cabecera Authorization (HTTP 401)', async () => {
      const req = createRequest({
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization');
    });

    it('rechaza peticiones con esquemas no Bearer (ej. Basic) (HTTP 401)', async () => {
      const req = createRequest({
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rechaza peticiones con token Bearer incorrecto (HTTP 401)', async () => {
      const req = createRequest({
        headers: { Authorization: 'Bearer wrong-secret-key' },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('permite acceso con TASKS_AUTH_SECRET válido (HTTP 200)', async () => {
      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockWorker.processDispatch).toHaveBeenCalled();
    });

    it('permite acceso con token OIDC válido emitido por Google Cloud Tasks (HTTP 200)', async () => {
      const req = createRequest({
        headers: { Authorization: 'Bearer valid-google-oidc-jwt.payload.signature' },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('timingSafeCompare previene ataques de temporización', () => {
      expect(timingSafeCompare('secretA', 'secretA')).toBe(true);
      expect(timingSafeCompare('secretA', 'secretB')).toBe(false);
      expect(timingSafeCompare('short', 'much-longer-secret')).toBe(false);
    });
  });

  describe('2. Inmunidad a Parameter Tampering y Sanitización de Entradas', () => {
    it('bloquea inyecciones de parámetros adicionales (Mass Assignment) gracias a .strict() (HTTP 400)', async () => {
      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: {
          postId: 'post-1',
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
          isAdmin: true, // Parámetro inyectado
          forcePublish: true,
        },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Validación fallida');
      expect(mockWorker.processDispatch).not.toHaveBeenCalled();
    });

    it('rechaza idempotencyKey que no cumpla formato UUID v4 (HTTP 400)', async () => {
      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: {
          postId: 'post-1',
          idempotencyKey: 'not-a-valid-uuid-string',
        },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('UUID');
    });

    it('rechaza postId con caracteres ilegales o intentos de inyección (HTTP 400)', async () => {
      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: {
          postId: '../../../etc/passwd',
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rechaza JSON malformado (HTTP 400)', async () => {
      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        rawBody: '{"invalidJson',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('3. Códigos HTTP y Supresión de Stack Traces', () => {
    it('retorna HTTP 503 ante fallos transitorios para activar reintentos de Cloud Tasks', async () => {
      mockWorker.processDispatch.mockRejectedValueOnce(
        new TransientDispatchError('Meta 429 Rate Limit')
      );

      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain('transitorio');
    });

    it('suprime stack traces y detalles de infraestructura ante errores no controlados (HTTP 500)', async () => {
      mockWorker.processDispatch.mockRejectedValueOnce(
        new Error('FATAL: Database connection string mongodb://user:pass@internal-cluster leaked!')
      );

      const req = createRequest({
        headers: { Authorization: `Bearer ${VALID_SECRET}` },
        body: { postId: 'post-1', idempotencyKey: VALID_IDEMPOTENCY_KEY },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      // Blindaje contra Information Leakage: mensaje genérico sin trazas técnicas
      expect(data.error).toBe('Error interno del servidor al procesar la tarea de despacho');
      expect(JSON.stringify(data)).not.toContain('mongodb');
      expect(JSON.stringify(data)).not.toContain('pass@internal-cluster');
    });
  });
});
