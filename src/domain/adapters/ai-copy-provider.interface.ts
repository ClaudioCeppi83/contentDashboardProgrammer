/**
 * @file ai-copy-provider.interface.ts
 * @description Puerto secundario canónico (Outbound Port) para la adaptación y generación de copy con Inteligencia Artificial.
 * Desacopla la lógica de aplicación y de negocio de proveedores externos de LLM (Google Gemini, OpenAI, Claude, mocks).
 * 
 * Regla de Arquitectura: Arquitectura Hexagonal / Ports & Adapters.
 * La capa de Dominio permanece pura, sin dependencias de SDKs externos, fetch o librerías HTTP.
 */

import type { InstagramFormat } from '../models/post.types';

/**
 * Parámetros de entrada para la adaptación de copy orientada a Instagram.
 */
export interface AdaptCopyInput {
  /** Texto original, briefing, guión de video o borrador a adaptar */
  briefing: string;
  /** Formato de Instagram deseado (opcional, si se requiere forzar uno específico) */
  format?: InstagramFormat;
  /** Tono de voz requerido (ej. 'inspirational', 'educational', 'casual', 'humorous', 'professional') */
  tone?: string;
  /** Definición del público objetivo / Buyer Persona */
  targetAudience?: string;
  /** Guía de estilo o voz de marca (Brand Voice) */
  brandVoice?: string;
  /** Hashtags preferidos o menciones obligatorias solicitadas por el cliente */
  preferredHashtags?: string[];
  /** Llamada a la acción (Call to Action / CTA) prioritaria */
  callToAction?: string;
  /** Código de idioma ISO para la generación (predeterminado: 'es') */
  language?: string;
  /**
   * Firma de pensamiento (thought signature) capturada previamente.
   * Preservada para mantener la trazabilidad de razonamiento y memoria en Gemini 3.
   */
  previousThoughtSignature?: string;
}

/**
 * Salida estructurada de la adaptación de copy para Instagram.
 */
export interface AdaptedCopyResult {
  /** Texto del caption optimizado (gancho en primeras 2 líneas, micro-párrafos, emojis, <2200 chars) */
  caption: string;
  /** Recuento exacto de caracteres del texto de caption */
  characterCount: number;
  /** Lista de 5 a 15 hashtags hiperrelevantes segmentados */
  hashtags: string[];
  /** Primer comentario dedicado para hashtags complementarios o enlace en bio */
  firstComment: string;
  /** Formato de Instagram recomendado para el contenido adaptado */
  formatRecommendation: InstagramFormat;
  /**
   * Firma de pensamiento generada por el modelo (Gemini 3.8 Flash).
   * Almacenada para trazabilidad, auditoría y multi-turn prompting.
   */
  thoughtSignature?: string;
}

/**
 * Error base del dominio de adaptación de copy con IA.
 */
export class AICopyError extends Error {
  constructor(
    message: string,
    public readonly isTransient: boolean = false,
    public readonly statusCode?: number,
    public readonly causeError?: unknown
  ) {
    super(message);
    this.name = 'AICopyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error por límite de tasa (Rate Limit / Quota Exceeded - HTTP 429).
 */
export class AICopyRateLimitError extends AICopyError {
  constructor(message: string, public readonly retryAfterSeconds?: number, causeError?: unknown) {
    super(message, true, 429, causeError);
    this.name = 'AICopyRateLimitError';
  }
}

/**
 * Error por indisponibilidad o sobrecarga del servicio de IA (HTTP 503 / 502).
 */
export class AICopyUnavailableError extends AICopyError {
  constructor(message: string, causeError?: unknown) {
    super(message, true, 503, causeError);
    this.name = 'AICopyUnavailableError';
  }
}

/**
 * Error por timeout adaptativo de la llamada al proveedor de IA.
 */
export class AICopyTimeoutError extends AICopyError {
  constructor(message: string, causeError?: unknown) {
    super(message, true, 504, causeError);
    this.name = 'AICopyTimeoutError';
  }
}

/**
 * Error por solicitud inválida o credenciales erróneas (HTTP 400 / 401 / 403).
 */
export class AICopyInvalidRequestError extends AICopyError {
  constructor(message: string, statusCode: number = 400, causeError?: unknown) {
    super(message, false, statusCode, causeError);
    this.name = 'AICopyInvalidRequestError';
  }
}

/**
 * Error de validación o detección de inyecciones de prompt.
 */
export class AICopyValidationError extends AICopyError {
  constructor(message: string) {
    super(message, false, 400);
    this.name = 'AICopyValidationError';
  }
}

/**
 * Contrato del Puerto de Proveedor de Copy con IA.
 */
export interface AICopyProviderAdapter {
  /** Identificador único del proveedor (ej. 'gemini', 'mock') */
  readonly providerName: string;

  /**
   * Adapta un briefing o borrador a un copy estructurado de alto impacto para Instagram.
   * 
   * @param input Parámetros de entrada validados y sanitizados.
   * @returns Salida estructurada conforme al contrato de Instagram.
   */
  adaptCopy(input: AdaptCopyInput): Promise<AdaptedCopyResult>;
}
