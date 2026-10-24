/**
 * @file route.ts
 * @description Route Handler HTTP para el worker de despacho de Google Cloud Tasks (/api/tasks/dispatch-post).
 * Implementa autenticación estricta (OIDC de Google Cloud Tasks y Bearer secret),
 * sanitización rigurosa de entradas e inmunidad contra Parameter Tampering y Replay Attacks.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import { StorageService } from '@/infrastructure/storage/storage.service';
import {
  DispatchWorkerService,
  TransientDispatchError,
} from '@/application/services/dispatch-worker.service';
import { getSocialPublisher } from '@/adapters/publishers/publisher.factory';
import type { SocialPublisherAdapter } from '@/domain/adapters/social-publisher.interface';

// Esquema Zod con modo .strict() para bloquear inyecciones de parámetros (Parameter Tampering)
export const DispatchPayloadSchema = z
  .object({
    postId: z
      .string()
      .min(1, 'postId no puede estar vacío')
      .max(128, 'postId excede longitud máxima permitida')
      .regex(/^[a-zA-Z0-9_-]+$/, 'postId contiene caracteres no permitidos'),
    idempotencyKey: z
      .string()
      .uuid('idempotencyKey debe ser un formato UUID v4 válido'),
    attemptNumber: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .default(0),
  })
  .strict();

export type ValidatedDispatchPayload = z.infer<typeof DispatchPayloadSchema>;

/**
 * Comparación segura contra ataques de temporización (Timing Attacks).
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

let oauthClient: OAuth2Client | null = null;
function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    oauthClient = new OAuth2Client();
  }
  return oauthClient;
}

/**
 * Valida la firma criptográfica y las afirmaciones (claims) del token OIDC de Google Cloud Tasks.
 */
export async function verifyGoogleOidcToken(
  token: string,
  expectedAudience?: string
): Promise<boolean> {
  try {
    const client = getOAuthClient();
    const audience =
      expectedAudience ||
      process.env.CLOUD_TASKS_OIDC_AUDIENCE ||
      process.env.NEXTAUTH_URL;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: audience || undefined,
    });

    const payload = ticket.getPayload();
    if (!payload) return false;

    // Verificar emisor oficial de Google
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      return false;
    }

    // Verificar cuenta de servicio autorizada si está configurada en variables de entorno
    const allowedServiceAccount = process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL;
    if (allowedServiceAccount && payload.email !== allowedServiceAccount) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validador de autenticación con principio de denegación por defecto (Fail-Closed).
 */
export async function verifyTaskAuth(
  req: Request
): Promise<{ authenticated: boolean; method?: 'bearer' | 'oidc'; error?: string }> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Cabecera Authorization Bearer ausente o con formato incorrecto',
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { authenticated: false, error: 'Token Bearer vacío' };
  }

  // 1. Esquema Bearer Secret estático (TASKS_AUTH_SECRET) con comparación de tiempo constante
  const expectedSecret = process.env.TASKS_AUTH_SECRET;
  if (expectedSecret && expectedSecret.length > 0) {
    if (timingSafeCompare(token, expectedSecret)) {
      return { authenticated: true, method: 'bearer' };
    }
  }

  // 2. Esquema OIDC de Google Cloud Tasks (JWT de 3 partes)
  const isJwt = token.split('.').length === 3;
  if (isJwt) {
    const isOidcValid = await verifyGoogleOidcToken(token);
    if (isOidcValid) {
      return { authenticated: true, method: 'oidc' };
    }
  }

  return {
    authenticated: false,
    error: 'Credencial de autenticación no válida o expirada',
  };
}

let activeWorkerService: DispatchWorkerService | null = null;

export function setWorkerServiceForTesting(service: DispatchWorkerService | null): void {
  activeWorkerService = service;
}

function getWorkerService(): DispatchWorkerService {
  if (activeWorkerService) {
    return activeWorkerService;
  }

  const firestoreService = new FirestoreService();
  const storageService = new StorageService();
  const publisher: SocialPublisherAdapter = getSocialPublisher();

  return new DispatchWorkerService(firestoreService, storageService, publisher);
}

/**
 * Handler principal POST /api/tasks/dispatch-post
 */
export async function POST(req: Request): Promise<NextResponse> {
  // 1. Verificación estricta de Autenticación (OIDC / Bearer Secret)
  const authCheck = await verifyTaskAuth(req);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      {
        success: false,
        error: authCheck.error || 'No autorizado',
      },
      { status: 401 }
    );
  }

  // 2. Extracción y parseo seguro del cuerpo JSON
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Cuerpo de la petición no es un JSON válido',
      },
      { status: 400 }
    );
  }

  // 3. Validación de esquema e inmunidad a Parameter Tampering con Zod .strict()
  const validationResult = DispatchPayloadSchema.safeParse(rawBody);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues.map((issue) => issue.message).join(', ');
    return NextResponse.json(
      {
        success: false,
        error: `Validación fallida: ${errorDetails}`,
      },
      { status: 400 }
    );
  }

  const payload: ValidatedDispatchPayload = validationResult.data;

  // 4. Procesamiento transaccional en el Worker
  try {
    const worker = getWorkerService();
    const outcome = await worker.processDispatch(payload);

    return NextResponse.json(
      {
        success: true,
        outcome,
      },
      { status: 200 }
    );
  } catch (error) {
    // Manejo de fallo transitorio: HTTP 503 para que Cloud Tasks aplique reintentos automáticos
    if (error instanceof TransientDispatchError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error transitorio de red o servicio externo. Reintento programado.',
        },
        { status: 503 }
      );
    }

    // Supresión absoluta de Stack Traces y detalles técnicos en errores internos 500
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor al procesar la tarea de despacho',
      },
      { status: 500 }
    );
  }
}
