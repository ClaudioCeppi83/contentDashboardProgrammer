/**
 * @file post.types.ts
 * @description Tipos canónicos del dominio de Posts para Social Ops Dashboard (v0.1.0).
 * Define la SSoT (Single Source of Truth) para Firestore y la Máquina de Estados Finitos (FSM).
 * 
 * Regla de Arquitectura: Capa de Dominio puro. Cero dependencias externas o de frameworks.
 */

/**
 * Estados del ciclo de vida del post gobernados por la FSM.
 */
export type PostState =
  | 'idea'
  | 'in_progress'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

/**
 * Formatos nativos de Instagram admitidos en el MVP v0.1.0.
 */
export type InstagramFormat = 'feed_post' | 'carousel' | 'reel';

/**
 * Especificación de asset multimedia para Instagram en Cloud Storage.
 */
export interface InstagramMediaAsset {
  id: string;
  storagePath: string;
  downloadUrl: string; // gs:// o Signed URL temporal
  mimeType: 'image/jpeg' | 'image/png' | 'video/mp4';
  sizeBytes: number;
  width: number;
  height: number;
  aspectRatio: string; // "1:1", "4:5", "9:16"
  durationSeconds?: number;
  validationPassed: boolean;
  validationError?: string;
}

/**
 * Estructura del copy validado para Instagram.
 */
export interface InstagramCopyData {
  caption: string;
  characterCount: number;
  characterLimit: number; // Límite de 2,200 caracteres para Instagram
  hashtags: string[];
  firstComment?: string; // Espacio para hashtags limpios o enlaces a bio
  isValid: boolean;
}

/**
 * Registro de feedback o auditoría en el flujo de aprobación y edición.
 */
export interface PostComment {
  id: string;
  authorId: string;
  authorRole: 'cm' | 'client' | 'system';
  content: string;
  createdAt: string; // ISO-8601 UTC
  statusChangeFrom?: PostState;
  statusChangeTo?: PostState;
}

/**
 * Detalle del resultado final de la invocación al API de publicación.
 */
export interface PostPublishResult {
  mediaContainerId?: string;
  mediaId?: string;
  permalink?: string;
  error?: string;
}

/**
 * Esquema canónico del documento en Firestore (`posts/{postId}`).
 */
export interface PostDocument {
  id: string;
  clientId: string;
  authorId: string;
  title: string;
  briefingScript?: string;
  state: PostState;
  platform: 'instagram'; // v0.1.0 exclusivo, extensible en v0.2.0+
  format: InstagramFormat;
  copy: InstagramCopyData;
  media: InstagramMediaAsset[];
  scheduledAt?: string | null; // ISO-8601 UTC
  cloudTaskName?: string | null;
  idempotencyKey?: string | null; // UUID v4 único por agendamiento
  comments: PostComment[];
  publishedAt?: string | null;
  publishResult?: PostPublishResult;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
}

/**
 * Matriz canónica de transiciones permitidas en la FSM.
 * Garantiza que ninguna transición ilegítima ocurra en la SSoT.
 */
export const VALID_POST_TRANSITIONS: Readonly<Record<PostState, readonly PostState[]>> = {
  idea: ['in_progress'],
  in_progress: ['in_review'],
  in_review: ['changes_requested', 'approved'],
  changes_requested: ['in_progress'],
  approved: ['scheduled', 'in_progress'],
  scheduled: ['in_progress', 'approved', 'publishing'],
  publishing: ['published', 'failed'],
  published: [], // Estado terminal de éxito
  failed: ['in_progress'], // Permite diagnóstico y reintento operativo
};

/**
 * Resultado de validación pre-flight antes del agendamiento.
 */
export interface PreflightValidationResult {
  isValid: boolean;
  errors: string[];
}
