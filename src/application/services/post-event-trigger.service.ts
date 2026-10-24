/**
 * @file post-event-trigger.service.ts
 * @description Servicio de aplicación para disparadores reactivos de eventos (Firestore onDocumentWritten).
 * Detecta transiciones hacia o desde el estado 'scheduled' para encolar o cancelar tareas en Cloud Tasks.
 */

import type { PostDocument } from '@/domain/models/post.types';
import type { TaskScheduler } from '@/infrastructure/tasks/cloud-tasks.service';

export interface PostPersistencePort {
  updatePost(postId: string, data: Partial<PostDocument>): Promise<PostDocument>;
}

export type TriggerAction = 'scheduled' | 'rescheduled' | 'cancelled' | 'none';

export interface PostTriggerResult {
  action: TriggerAction;
  postId: string;
  taskName?: string;
  previousTaskName?: string;
}

export class PostEventTriggerService {
  constructor(
    private readonly taskScheduler: TaskScheduler,
    private readonly persistence: PostPersistencePort
  ) {}

  /**
   * Procesa el cambio entre el estado previo y nuevo de un documento Post.
   * Compatible con Cloud Functions onDocumentWritten o invocaciones de casos de uso.
   */
  async handlePostChange(
    before: PostDocument | null,
    after: PostDocument | null
  ): Promise<PostTriggerResult> {
    // 1. Detección de entrada al estado 'scheduled' (Nuevo agendamiento o reprogramación)
    if (after && after.state === 'scheduled') {
      return this.handleEnteringScheduled(before, after);
    }

    // 2. Detección de salida del estado 'scheduled' (Des-agendado, edición o borrado)
    if (before && before.state === 'scheduled') {
      return this.handleExitingScheduled(before, after);
    }

    // 3. Sin transiciones relevantes para Cloud Tasks
    return {
      action: 'none',
      postId: after?.id ?? before?.id ?? '',
    };
  }

  private async handleEnteringScheduled(
    before: PostDocument | null,
    after: PostDocument
  ): Promise<PostTriggerResult> {
    const isNewSchedule = !before || before.state !== 'scheduled';
    const isRescheduled =
      before &&
      before.state === 'scheduled' &&
      (before.scheduledAt !== after.scheduledAt || before.idempotencyKey !== after.idempotencyKey);

    if (!isNewSchedule && !isRescheduled) {
      return { action: 'none', postId: after.id, taskName: after.cloudTaskName ?? undefined };
    }

    if (!after.scheduledAt) {
      throw new Error(`Post ${after.id} en estado 'scheduled' no posee 'scheduledAt'.`);
    }

    if (!after.idempotencyKey) {
      throw new Error(`Post ${after.id} en estado 'scheduled' no posee 'idempotencyKey'.`);
    }

    // Si ya existía una tarea anterior (caso reprogramación), la cancelamos primero
    if (before?.cloudTaskName) {
      await this.taskScheduler.cancelPostDispatch(before.cloudTaskName);
    }

    // Programar la nueva tarea en Cloud Tasks
    const { taskName } = await this.taskScheduler.schedulePostDispatch({
      postId: after.id,
      idempotencyKey: after.idempotencyKey,
      scheduledAt: after.scheduledAt,
    });

    // Persistir el cloudTaskName en Firestore
    await this.persistence.updatePost(after.id, {
      cloudTaskName: taskName,
    });

    return {
      action: isRescheduled ? 'rescheduled' : 'scheduled',
      postId: after.id,
      taskName,
      previousTaskName: before?.cloudTaskName ?? undefined,
    };
  }

  private async handleExitingScheduled(
    before: PostDocument,
    after: PostDocument | null
  ): Promise<PostTriggerResult> {
    // Si la transición es hacia 'publishing' o 'published', es la ejecución normal del worker; no se cancela
    if (after && (after.state === 'publishing' || after.state === 'published')) {
      return {
        action: 'none',
        postId: before.id,
        taskName: before.cloudTaskName ?? undefined,
      };
    }

    // El post fue des-agendado, devuelto a borrador/revisión o eliminado
    if (before.cloudTaskName) {
      await this.taskScheduler.cancelPostDispatch(before.cloudTaskName);
    }

    // Si el documento aún existe y tiene cloudTaskName asignado, lo limpiamos en Firestore
    if (after && after.cloudTaskName) {
      await this.persistence.updatePost(after.id, {
        cloudTaskName: null,
      });
    }

    return {
      action: 'cancelled',
      postId: before.id,
      previousTaskName: before.cloudTaskName ?? undefined,
    };
  }
}
