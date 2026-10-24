/**
 * @file instagram-error.classifier.ts
 * @description Clasificador defensivo de errores de Meta Graph API.
 * Discrimina entre fallos transitorios (HTTP 503 con reintento Cloud Tasks)
 * y fallos terminales irreversibles (HTTP 200 con estado 'failed' en Firestore).
 */

export interface ClassifiedMetaError {
  isTransient: boolean;
  message: string;
  statusCode?: number;
  subcode?: number;
}

const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613]);
const TERMINAL_META_CODES = new Set([100, 190, 36003]);

export function classifyMetaGraphError(
  error: unknown,
  httpStatus?: number,
  responseBody?: any
): ClassifiedMetaError {
  // 1. Fallos de red puros, timeouts y cancelaciones de AbortController
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.includes('fetch failed')) {
      return {
        isTransient: true,
        message: `Error de conectividad de red con Meta Graph API: ${error.message}`,
        statusCode: httpStatus,
      };
    }
  }

  // 2. Extraer código de error de la carga útil de Meta Graph API
  const metaError = responseBody?.error;
  const errorCode = metaError?.code;
  const errorSubcode = metaError?.error_subcode;
  const rawMessage = metaError?.message || (error instanceof Error ? error.message : 'Error desconocido de Meta Graph API');

  if (typeof errorCode === 'number') {
    if (TRANSIENT_META_CODES.has(errorCode)) {
      return {
        isTransient: true,
        message: `Meta API error transitorio [${errorCode}]: ${rawMessage}`,
        statusCode: httpStatus,
        subcode: errorSubcode,
      };
    }

    if (TERMINAL_META_CODES.has(errorCode)) {
      return {
        isTransient: false,
        message: `Meta API error fatal [${errorCode}]: ${rawMessage}`,
        statusCode: httpStatus,
        subcode: errorSubcode,
      };
    }
  }

  // 3. Clasificación por códigos de estado HTTP estándar
  if (httpStatus) {
    if (httpStatus === 429 || httpStatus >= 500) {
      return {
        isTransient: true,
        message: `Fallo transitorio de Meta (HTTP ${httpStatus}): ${rawMessage}`,
        statusCode: httpStatus,
      };
    }

    if (httpStatus >= 400 && httpStatus < 500) {
      return {
        isTransient: false,
        message: `Fallo fatal de cliente/autenticación en Meta (HTTP ${httpStatus}): ${rawMessage}`,
        statusCode: httpStatus,
      };
    }
  }

  return {
    isTransient: true,
    message: rawMessage,
    statusCode: httpStatus,
  };
}
