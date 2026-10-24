/**
 * @file post-event-trigger.test.ts
 * @description Pruebas unitarias para PostEventTriggerService.
 * Valida la programación en Cloud Tasks al entrar a 'scheduled', la cancelación al des-agendar
 * y el manejo correcto al reprogramar o pasar a 'publishing'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PostEventTriggerService,
  type PostPersistencePort,
} from '@/application/services/post-event-trigger.service';
import { MockTaskScheduler } from '@/infrastructure/tasks/cloud-tasks.service';
import type { PostDocument } from '@/domain/models/post.types';

describe('PostEventTriggerService Reactive Trigger Tests', () => {
  let mockScheduler: MockTaskScheduler;
  let mockPersistence: PostPersistencePort;
  let triggerService: PostEventTriggerService;

  const basePost: PostDocument = {
    id: 'post-test-1',
    clientId: 'client-1',
    authorId: 'cm-1',
    title: 'Post de Lanzamiento',
    state: 'approved',
    platform: 'instagram',
    format: 'feed_post',
    copy: {
      caption: 'Copy del post',
      characterCount: 13,
      characterLimit: 2200,
      hashtags: [],
      isValid: true,
    },
    media: [],
    comments: [],
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
  };

  beforeEach(() => {
    mockScheduler = new MockTaskScheduler();
    mockPersistence = {
      updatePost: vi.fn(async (id: string, data: Partial<PostDocument>) => ({
        ...basePost,
        ...data,
        id,
      })),
    };
    triggerService = new PostEventTriggerService(mockScheduler, mockPersistence);
  });

  describe('1. Transición hacia "scheduled"', () => {
    it('programa una tarea en Cloud Tasks y persiste cloudTaskName en Firestore', async () => {
      const scheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-1',
      };

      const result = await triggerService.handlePostChange(basePost, scheduledPost);

      expect(result.action).toBe('scheduled');
      expect(result.taskName).toBeDefined();
      expect(result.taskName).toContain('mock-task-post-test-1');

      // Verifica que se haya guardado en Cloud Tasks
      const scheduledTask = mockScheduler.getTask(result.taskName!);
      expect(scheduledTask?.options.idempotencyKey).toBe('idemp-key-1');
      expect(scheduledTask?.options.scheduledAt).toBe('2026-10-25T15:00:00.000Z');

      // Verifica persistencia en Firestore
      expect(mockPersistence.updatePost).toHaveBeenCalledWith('post-test-1', {
        cloudTaskName: result.taskName,
      });
    });

    it('cancela la tarea anterior y programa una nueva al reprogramar fecha o idempotencyKey', async () => {
      const oldScheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-old',
        cloudTaskName: 'projects/mock/tasks/old-task-1',
      };

      // Registrar la tarea vieja en el mock
      mockScheduler.scheduledTasks.set(oldScheduledPost.cloudTaskName!, {
        options: {
          postId: oldScheduledPost.id,
          idempotencyKey: oldScheduledPost.idempotencyKey!,
          scheduledAt: oldScheduledPost.scheduledAt!,
        },
        cancelled: false,
      });

      const rescheduledPost: PostDocument = {
        ...oldScheduledPost,
        scheduledAt: '2026-10-26T18:00:00.000Z',
        idempotencyKey: 'idemp-key-new',
      };

      const result = await triggerService.handlePostChange(oldScheduledPost, rescheduledPost);

      expect(result.action).toBe('rescheduled');
      expect(result.previousTaskName).toBe('projects/mock/tasks/old-task-1');
      expect(result.taskName).toBeDefined();

      // Verifica que la tarea vieja haya sido cancelada
      const oldTask = mockScheduler.getTask('projects/mock/tasks/old-task-1');
      expect(oldTask?.cancelled).toBe(true);

      // Verifica que la nueva esté registrada
      const newTask = mockScheduler.getTask(result.taskName!);
      expect(newTask?.options.scheduledAt).toBe('2026-10-26T18:00:00.000Z');
      expect(newTask?.options.idempotencyKey).toBe('idemp-key-new');
    });

    it('lanza error si falta scheduledAt al entrar a scheduled', async () => {
      const invalidPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        idempotencyKey: 'idemp-key-1',
      };

      await expect(triggerService.handlePostChange(basePost, invalidPost)).rejects.toThrow(
        "no posee 'scheduledAt'"
      );
    });

    it('lanza error si falta idempotencyKey al entrar a scheduled', async () => {
      const invalidPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
      };

      await expect(triggerService.handlePostChange(basePost, invalidPost)).rejects.toThrow(
        "no posee 'idempotencyKey'"
      );
    });

    it('no realiza acciones si el post ya estaba scheduled sin cambios de fecha o idempotencia', async () => {
      const scheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-1',
        cloudTaskName: 'projects/mock/tasks/existing-1',
      };

      const result = await triggerService.handlePostChange(scheduledPost, { ...scheduledPost });
      expect(result.action).toBe('none');
      expect(mockPersistence.updatePost).not.toHaveBeenCalled();
    });
  });

  describe('2. Transición de salida de "scheduled"', () => {
    it('cancela la tarea en Cloud Tasks y limpia cloudTaskName al des-agendar a "in_progress"', async () => {
      const scheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-1',
        cloudTaskName: 'projects/mock/tasks/task-to-cancel',
      };

      mockScheduler.scheduledTasks.set(scheduledPost.cloudTaskName!, {
        options: {
          postId: scheduledPost.id,
          idempotencyKey: scheduledPost.idempotencyKey!,
          scheduledAt: scheduledPost.scheduledAt!,
        },
        cancelled: false,
      });

      const inProgressPost: PostDocument = {
        ...scheduledPost,
        state: 'in_progress',
      };

      const result = await triggerService.handlePostChange(scheduledPost, inProgressPost);

      expect(result.action).toBe('cancelled');
      expect(result.previousTaskName).toBe('projects/mock/tasks/task-to-cancel');

      // Verifica que la tarea esté cancelada
      const task = mockScheduler.getTask('projects/mock/tasks/task-to-cancel');
      expect(task?.cancelled).toBe(true);

      // Verifica limpieza en Firestore
      expect(mockPersistence.updatePost).toHaveBeenCalledWith('post-test-1', {
        cloudTaskName: null,
      });
    });

    it('no cancela la tarea si la transición es hacia "publishing" (ejecución del worker)', async () => {
      const scheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-1',
        cloudTaskName: 'projects/mock/tasks/task-running',
      };

      const publishingPost: PostDocument = {
        ...scheduledPost,
        state: 'publishing',
      };

      const result = await triggerService.handlePostChange(scheduledPost, publishingPost);

      expect(result.action).toBe('none');
      expect(mockPersistence.updatePost).not.toHaveBeenCalled();
    });

    it('cancela la tarea si el documento post es eliminado (after === null)', async () => {
      const scheduledPost: PostDocument = {
        ...basePost,
        state: 'scheduled',
        scheduledAt: '2026-10-25T15:00:00.000Z',
        idempotencyKey: 'idemp-key-1',
        cloudTaskName: 'projects/mock/tasks/task-to-delete',
      };

      mockScheduler.scheduledTasks.set(scheduledPost.cloudTaskName!, {
        options: {
          postId: scheduledPost.id,
          idempotencyKey: scheduledPost.idempotencyKey!,
          scheduledAt: scheduledPost.scheduledAt!,
        },
        cancelled: false,
      });

      const result = await triggerService.handlePostChange(scheduledPost, null);

      expect(result.action).toBe('cancelled');
      const task = mockScheduler.getTask('projects/mock/tasks/task-to-delete');
      expect(task?.cancelled).toBe(true);
    });
  });

  describe('3. Transiciones irrelevantes', () => {
    it('retorna action "none" cuando ninguna transición involucra "scheduled"', async () => {
      const inReviewPost: PostDocument = {
        ...basePost,
        state: 'in_review',
      };

      const result = await triggerService.handlePostChange(basePost, inReviewPost);
      expect(result.action).toBe('none');
      expect(mockPersistence.updatePost).not.toHaveBeenCalled();
    });
  });
});
