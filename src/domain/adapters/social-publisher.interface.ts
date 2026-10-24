/**
 * @file social-publisher.interface.ts
 * @description Contrato canónico (Puerto Secundario / Outbound Port) para la publicación en redes sociales.
 * Desacopla la lógica de negocio de los SDKs de terceros (Meta Graph API, TikTok API, etc.).
 * 
 * Regla de Arquitectura: Hexagonal / Ports & Adapters.
 * La capa de Dominio no conoce Axios, Fetch, ni SDKs externos; únicamente este contrato.
 */

import type { PostDocument, InstagramMediaAsset, PreflightValidationResult } from '../models/post.types';

/**
 * Opciones de ejecución pasadas al publicador durante el despacho.
 */
export interface PublishOptions {
  /** Map de IDs de asset a Signed URLs de Cloud Storage con vigencia temporal */
  signedUrls?: Record<string, string>;
  /** Clave de idempotencia única para garantizar que no haya doble publicación en la red social */
  idempotencyKey?: string;
  /** Número de intento actual ejecutado por el worker de Cloud Tasks */
  attemptNumber?: number;
}

/**
 * Estado del contenedor de procesamiento asíncrono de medios (ej. Reels o videos en Meta Graph API).
 */
export type MediaContainerProcessingState = 'in_progress' | 'finished' | 'error';

/**
 * Resultado estructurado devuelto por cualquier implementación del publicador.
 */
export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  permalink?: string;
  mediaContainerId?: string;
  error?: string;
  isTransientError?: boolean; // Indica si se debe reintentar con HTTP 503 o es un error fatal (HTTP 200)
  rawResponse?: unknown;
}

/**
 * Contrato canónico del Publicador de Redes Sociales.
 * 
 * Implementaciones:
 * - v0.1.0: InstagramGraphAdapter (Meta Graph API) y MockPublisherProvider (Tests / Dev).
 * - v0.2.0+: TikTokPublisherAdapter, LinkedInPublisherAdapter, XPublisherAdapter.
 */
export interface SocialPublisherAdapter {
  /** Identificador de la plataforma soportada (ej. 'instagram', 'tiktok', 'linkedin') */
  readonly platform: string;

  /**
   * Valida en pre-flight que los assets y copy cumplan las restricciones técnicas de la plataforma.
   */
  validatePreflight(post: PostDocument): Promise<PreflightValidationResult>;

  /**
   * Crea un contenedor de medio previo a la publicación definitiva (necesario para Instagram/Meta).
   */
  createMediaContainer?(asset: InstagramMediaAsset, caption: string): Promise<string>;

  /**
   * Consulta el estado de procesamiento del contenedor de medio asíncrono.
   */
  checkContainerStatus?(containerId: string): Promise<MediaContainerProcessingState>;

  /**
   * Ejecuta la publicación definitiva del contenido en la red social.
   * Debe ser idempotente: si se invoca con la misma idempotencyKey, retorna el resultado previo sin duplicar.
   */
  publish(post: PostDocument, options?: PublishOptions): Promise<PublishResult>;
}
