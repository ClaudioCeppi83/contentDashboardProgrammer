/**
 * @file client-portal.validator.ts
 * @description Validador y sanitizador estricto para el parámetro clientId del Portal de Cliente.
 * Mitiga vectores de Path Traversal, Cross-Site Scripting (XSS), Null Byte Injection y manipulación de rutas.
 */

export interface ClientIdValidationResult {
  isValid: boolean;
  sanitizedClientId: string | null;
  errors: string[];
}

/**
 * Patrón canónico seguro para identificadores de cliente:
 * - Longitud: entre 2 y 64 caracteres.
 * - Caracteres permitidos: alfanuméricos en minúsculas/mayúsculas, guiones y guiones bajos.
 * - Debe comenzar y terminar con un carácter alfanumérico.
 */
export const CLIENT_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}[a-zA-Z0-9]$/;

/**
 * Patrones maliciosos expresamente vetados para detección heurística de intrusiones.
 */
const DANGEROUS_PATTERNS = [
  /\.\./, // Path Traversal (..)
  /[/\\]/, // Separadores de ruta (/ o \)
  /\0|%00/i, // Null byte
  /%2e%2e|%2f|%5c/i, // URL Encoded traversal (%2e, %2f, %5c)
  /<[^>]*>/, // Etiquetas HTML / Inyección de Script
  /javascript:|data:|vbscript:/i, // Pseudo-protocolos maliciosos
  /[\r\n\t]/, // Caracteres de control
  /[;'"$|&`]/, // Caracteres de inyección de comandos o SQL
];

/**
 * Valida y sanitiza exhaustivamente el identificador clientId recibido en rutas dinámicas o parámetros.
 *
 * @param rawClientId Valor bruto recibido en parámetros de ruta (/portal/[clientId]) o query strings.
 * @returns ClientIdValidationResult Resultado de validación con errores tipados y el identificador limpio.
 */
export function validateClientId(rawClientId: unknown): ClientIdValidationResult {
  const errors: string[] = [];

  if (typeof rawClientId !== 'string') {
    return {
      isValid: false,
      sanitizedClientId: null,
      errors: ['El parámetro clientId debe ser una cadena de texto válida.'],
    };
  }

  const trimmed = rawClientId.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      sanitizedClientId: null,
      errors: ['El parámetro clientId no puede estar vacío.'],
    };
  }

  if (trimmed.length < 2 || trimmed.length > 64) {
    errors.push(
      `Longitud de clientId fuera de rango permitido (2-64 caracteres): recibido ${trimmed.length} caracteres.`
    );
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push('El parámetro clientId contiene secuencias de caracteres peligrosos o no autorizados.');
      break;
    }
  }

  if (!CLIENT_ID_REGEX.test(trimmed)) {
    errors.push(
      'El formato de clientId es inválido. Solo se admiten caracteres alfanuméricos, guiones (-) y guiones bajos (_), iniciando y terminando con un alfanumérico.'
    );
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      sanitizedClientId: null,
      errors,
    };
  }

  return {
    isValid: true,
    sanitizedClientId: trimmed,
    errors: [],
  };
}
