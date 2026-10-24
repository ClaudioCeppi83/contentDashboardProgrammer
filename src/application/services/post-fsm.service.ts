/**
 * @file post-fsm.service.ts
 * @description Servicio que implementa la Máquina de Estados Finitos (FSM) y guardas de negocio.
 */

// Generador UUID universal compatible con browser (Web Crypto API) y Node.js (globalThis.crypto)
function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import {
  VALID_POST_TRANSITIONS,
  type PostComment,
  type PostDocument,
  type PostPublishResult,
  type PostState,
} from '@/domain/models/post.types';
import { validateInstagramCopy } from '../validation/preflight-copy.validator';
import { validateInstagramMedia } from '../validation/preflight-media.validator';

export class FsmTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsmTransitionError';
  }
}

export class FsmGuardError extends FsmTransitionError {
  constructor(message: string) {
    super(message);
    this.name = 'FsmGuardError';
  }
}

export interface TransitionCommentData {
  id?: string;
  authorId?: string;
  authorRole?: 'cm' | 'client' | 'system';
  content: string;
}

export interface TransitionPayload {
  scheduledAt?: string;
  comment?: string | TransitionCommentData | PostComment;
  feedback?: string;
  cloudTaskName?: string | null;
  publishResult?: PostPublishResult;
  publishedAt?: string | null;
  [key: string]: unknown;
}

const MINIMUM_SCHEDULE_BUFFER_MS = 2 * 60 * 1000; // 2 minutos

export class PostFsmService {
  private readonly nowProvider: () => Date;

  constructor(nowProvider?: () => Date) {
    this.nowProvider = nowProvider ?? (() => new Date());
  }

  transition(
    post: PostDocument,
    targetState: PostState,
    payload?: TransitionPayload
  ): PostDocument {
    this.validateStateTransition(post.state, targetState);

    const now = this.nowProvider();
    const nowIso = now.toISOString();

    let scheduledAt = post.scheduledAt;
    let idempotencyKey = post.idempotencyKey;
    let cloudTaskName = post.cloudTaskName;

    if (targetState === 'scheduled') {
      scheduledAt = this.validateSchedulingGuards(post, payload, now);
      idempotencyKey = generateUUID();
    } else if (post.state === 'scheduled' && targetState !== 'publishing') {
      // Si se des-agenda o modifica, invalidamos cerrojo previo
      idempotencyKey = null;
      cloudTaskName = null;
    }

    const comments = this.processComments(post, targetState, payload, nowIso);

    return {
      ...post,
      state: targetState,
      scheduledAt,
      idempotencyKey,
      cloudTaskName: payload?.cloudTaskName !== undefined ? payload.cloudTaskName : cloudTaskName,
      comments,
      publishedAt: targetState === 'published' ? (payload?.publishedAt ?? nowIso) : post.publishedAt,
      publishResult: payload?.publishResult ?? post.publishResult,
      updatedAt: nowIso,
    };
  }

  private validateStateTransition(currentState: PostState, targetState: PostState): void {
    const allowed = VALID_POST_TRANSITIONS[currentState] ?? [];
    if (!allowed.includes(targetState)) {
      throw new FsmTransitionError(
        `Transición no permitida: de '${currentState}' a '${targetState}'. Transiciones válidas: [${allowed.join(', ')}].`
      );
    }
  }

  private validateSchedulingGuards(
    post: PostDocument,
    payload: TransitionPayload | undefined,
    now: Date
  ): string {
    if (post.state !== 'approved') {
      throw new FsmGuardError(
        `Guarda de agendamiento violada: el post debe estar en 'approved' (estado actual: '${post.state}').`
      );
    }

    const scheduledAt = payload?.scheduledAt ?? post.scheduledAt;
    if (!scheduledAt) {
      throw new FsmGuardError('La fecha de agendamiento (scheduledAt) es obligatoria.');
    }

    const scheduledTime = new Date(scheduledAt).getTime();
    if (Number.isNaN(scheduledTime)) {
      throw new FsmGuardError(`Formato inválido de fecha para scheduledAt: '${scheduledAt}'.`);
    }

    if (scheduledTime <= now.getTime() + MINIMUM_SCHEDULE_BUFFER_MS) {
      throw new FsmGuardError(
        `La fecha de agendamiento debe ser mayor a 2 minutos a partir de ahora (fecha mínima: ${new Date(
          now.getTime() + MINIMUM_SCHEDULE_BUFFER_MS
        ).toISOString()}).`
      );
    }

    const mediaResult = validateInstagramMedia(post.format, post.media);
    if (!mediaResult.isValid) {
      throw new FsmGuardError(
        `Guardas de medios violadas: ${mediaResult.errors.join(' | ')}`
      );
    }

    const copyResult = validateInstagramCopy(post.copy);
    if (!copyResult.isValid) {
      throw new FsmGuardError(
        `Guardas de copy violadas: ${copyResult.errors.join(' | ')}`
      );
    }

    return scheduledAt;
  }

  private processComments(
    post: PostDocument,
    targetState: PostState,
    payload: TransitionPayload | undefined,
    nowIso: string
  ): PostComment[] {
    const isChangesRequested = post.state === 'in_review' && targetState === 'changes_requested';
    const rawContent = this.extractCommentContent(payload);

    if (isChangesRequested && !rawContent) {
      throw new FsmGuardError(
        "Guarda violada: el feedback/comentario es obligatorio para solicitar cambios ('changes_requested')."
      );
    }

    if (!rawContent) {
      return [...post.comments];
    }

    const commentObj = typeof payload?.comment === 'object' ? payload.comment : undefined;
    const newComment: PostComment = {
      id: commentObj?.id ?? generateUUID(),
      authorId: commentObj?.authorId ?? (isChangesRequested ? 'client' : 'cm'),
      authorRole: commentObj?.authorRole ?? (isChangesRequested ? 'client' : 'cm'),
      content: rawContent,
      createdAt: nowIso,
      statusChangeFrom: post.state,
      statusChangeTo: targetState,
    };

    return [...post.comments, newComment];
  }

  private extractCommentContent(payload: TransitionPayload | undefined): string | null {
    if (!payload) return null;
    if (typeof payload.comment === 'string' && payload.comment.trim()) return payload.comment.trim();
    if (typeof payload.feedback === 'string' && payload.feedback.trim()) return payload.feedback.trim();
    if (typeof payload.comment === 'object' && payload.comment?.content?.trim()) {
      return payload.comment.content.trim();
    }
    return null;
  }
}
