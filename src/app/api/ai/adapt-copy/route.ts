/**
 * @file route.ts
 * @description Route Handler HTTP para el servicio de adaptación de copy con IA (/api/ai/adapt-copy).
 * Utiliza Gemini 3.8 Flash con Structured Output y thought signatures,
 * inyección configurable de dependencias (Gemini vs Mock) y mapeo estricto de códigos HTTP (200, 400, 429, 502).
 */

import { NextResponse } from 'next/server';
import { AICopyService } from '@/application/services/ai-copy.service';
import { getAICopyProvider } from '@/infrastructure/ai/ai-copy.factory';
import {
  AICopyValidationError,
  AICopyRateLimitError,
  AICopyUnavailableError,
  AICopyTimeoutError,
  AICopyInvalidRequestError,
} from '@/domain/adapters/ai-copy-provider.interface';

import { getTestingAICopyService } from './testing';

function getService(): AICopyService {
  const testingService = getTestingAICopyService();
  if (testingService) {
    return testingService;
  }
  const provider = getAICopyProvider();
  return new AICopyService(provider);
}

/**
 * POST /api/ai/adapt-copy
 * Adapta un briefing de contenido en un copy optimizado para Instagram.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // 1. Extracción y parseo seguro del cuerpo JSON
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'El cuerpo de la petición no es un JSON válido.',
      },
      { status: 400 }
    );
  }

  // 2. Procesamiento a través del servicio de aplicación
  try {
    const service = getService();
    const result = await service.adaptCopy(rawBody);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // 3. Mapeo clasificado de códigos HTTP
    if (error instanceof AICopyValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof AICopyInvalidRequestError) {
      const safeMessage = error.message.includes('GEMINI_API_KEY')
        ? 'Error de autenticación o configuración con el proveedor de IA.'
        : error.message.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');

      return NextResponse.json(
        {
          success: false,
          error: safeMessage,
        },
        { status: 400 }
      );
    }

    if (error instanceof AICopyRateLimitError) {
      const headers: Record<string, string> = {};
      if (error.retryAfterSeconds) {
        headers['Retry-After'] = error.retryAfterSeconds.toString();
      }
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 429,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        }
      );
    }

    if (error instanceof AICopyUnavailableError || error instanceof AICopyTimeoutError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 502 }
      );
    }

    // Supresión defensiva de stack traces e información sensible en errores no clasificados
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor al procesar la adaptación de copy con IA.',
      },
      { status: 500 }
    );
  }
}
