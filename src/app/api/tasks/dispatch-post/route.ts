/**
 * @file route.ts
 * @description Route Handler HTTP para el worker de despacho de Google Cloud Tasks (/api/tasks/dispatch-post).
 * Implementa autenticación estricta (OIDC de Google Cloud Tasks y Bearer secret),
 * sanitización rigurosa de entradas e inmunidad contra Parameter Tampering y Replay Attacks.
 */

import { NextResponse } from 'next/server';
import {
  DispatchPayloadSchema,
  type ValidatedDispatchPayload,
  verifyTaskAuth,
  getWorkerService,
} from './dispatch.helpers';
import { TransientDispatchError } from '@/application/services/dispatch-worker.service';


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
