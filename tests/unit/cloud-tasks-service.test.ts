/**
 * @file cloud-tasks-service.test.ts
 * @description Pruebas unitarias para CloudTasksService y MockTaskScheduler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MockTaskScheduler,
  CloudTasksService,
  getTaskScheduler,
} from '@/infrastructure/tasks/cloud-tasks.service';

describe('Cloud Tasks Infrastructure Service Tests', () => {
  describe('MockTaskScheduler', () => {
    let mockScheduler: MockTaskScheduler;

    beforeEach(() => {
      mockScheduler = new MockTaskScheduler();
    });

    it('programa una tarea y genera un taskName formateado', async () => {
      const result = await mockScheduler.schedulePostDispatch({
        postId: 'post-123',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        scheduledAt: '2026-10-24T22:00:00.000Z',
      });

      expect(result.taskName).toContain('projects/mock-project');
      expect(result.taskName).toContain('post-123');

      const saved = mockScheduler.getTask(result.taskName);
      expect(saved).toBeDefined();
      expect(saved?.cancelled).toBe(false);
      expect(saved?.options.postId).toBe('post-123');
    });

    it('cancela una tarea existente', async () => {
      const { taskName } = await mockScheduler.schedulePostDispatch({
        postId: 'post-456',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        scheduledAt: '2026-10-24T22:00:00.000Z',
      });

      const cancelled = await mockScheduler.cancelPostDispatch(taskName);
      expect(cancelled).toBe(true);

      const task = mockScheduler.getTask(taskName);
      expect(task?.cancelled).toBe(true);
    });

    it('retorna false al cancelar una tarea inexistente', async () => {
      const cancelled = await mockScheduler.cancelPostDispatch('projects/mock/tasks/unknown');
      expect(cancelled).toBe(false);
    });

    it('lanza error cuando shouldFailSchedule está activo', async () => {
      mockScheduler.shouldFailSchedule = true;
      await expect(
        mockScheduler.schedulePostDispatch({
          postId: 'post-err',
          idempotencyKey: 'key',
          scheduledAt: '2026-10-24T22:00:00.000Z',
        })
      ).rejects.toThrow('MockTaskScheduler');
    });

    it('lanza error cuando shouldFailCancel está activo', async () => {
      mockScheduler.shouldFailCancel = true;
      await expect(mockScheduler.cancelPostDispatch('task-err')).rejects.toThrow(
        'MockTaskScheduler'
      );
    });
  });

  describe('CloudTasksService Client Integration', () => {
    let mockClient: any;
    let service: CloudTasksService;

    beforeEach(() => {
      mockClient = {
        queuePath: vi.fn(
          (p: string, l: string, q: string) => `projects/${p}/locations/${l}/queues/${q}`
        ),
        createTask: vi.fn(async ({ parent, task }) => {
          return [{ name: `${parent}/tasks/task-${Date.now()}` }];
        }),
        deleteTask: vi.fn(async () => {
          return [{}];
        }),
      };

      service = new CloudTasksService({
        client: mockClient,
        projectId: 'test-project',
        location: 'europe-west1',
        queue: 'test-queue',
        workerUrl: 'https://api.example.com/api/tasks/dispatch-post',
        authSecret: 'bearer-secret-123',
        serviceAccountEmail: 'tasks-invoker@test-project.iam.gserviceaccount.com',
      });
    });

    it('construye la tarea con queuePath, scheduleTime en segundos y payload codificado en Base64', async () => {
      const scheduledIso = '2026-10-25T10:00:00.000Z';
      const expectedSeconds = Math.floor(new Date(scheduledIso).getTime() / 1000);

      const result = await service.schedulePostDispatch({
        postId: 'post-99',
        idempotencyKey: 'uuid-key-99',
        scheduledAt: scheduledIso,
      });

      expect(mockClient.queuePath).toHaveBeenCalledWith(
        'test-project',
        'europe-west1',
        'test-queue'
      );
      expect(mockClient.createTask).toHaveBeenCalledTimes(1);

      const callArgs = mockClient.createTask.mock.calls[0][0];
      expect(callArgs.parent).toBe('projects/test-project/locations/europe-west1/queues/test-queue');

      const httpReq = callArgs.task.httpRequest;
      expect(httpReq.httpMethod).toBe('POST');
      expect(httpReq.url).toBe('https://api.example.com/api/tasks/dispatch-post');
      expect(httpReq.headers['Authorization']).toBe('Bearer bearer-secret-123');
      expect(httpReq.oidcToken).toEqual({
        serviceAccountEmail: 'tasks-invoker@test-project.iam.gserviceaccount.com',
        audience: 'https://api.example.com/api/tasks/dispatch-post',
      });

      // Decodificar el body Base64 y verificar
      const decodedBody = JSON.parse(Buffer.from(httpReq.body, 'base64').toString('utf-8'));
      expect(decodedBody).toEqual({
        postId: 'post-99',
        idempotencyKey: 'uuid-key-99',
      });

      expect(callArgs.task.scheduleTime.seconds).toBe(expectedSeconds);
      expect(result.taskName).toContain('test-queue/tasks/task-');
    });

    it('elimina la tarea correctamente con deleteTask', async () => {
      const taskName = 'projects/test/locations/us/queues/q/tasks/t1';
      const res = await service.cancelPostDispatch(taskName);

      expect(res).toBe(true);
      expect(mockClient.deleteTask).toHaveBeenCalledWith({ name: taskName });
    });

    it('retorna false pacíficamente si la tarea no se encuentra (código gRPC 5 NOT_FOUND)', async () => {
      const notFoundError = new Error('Task not found');
      (notFoundError as any).code = 5;
      mockClient.deleteTask.mockRejectedValueOnce(notFoundError);

      const res = await service.cancelPostDispatch('projects/test/tasks/already-deleted');
      expect(res).toBe(false);
    });

    it('lanza el error si ocurre una falla distinta a NOT_FOUND en deleteTask', async () => {
      const permissionError = new Error('Permission Denied');
      (permissionError as any).code = 7;
      mockClient.deleteTask.mockRejectedValueOnce(permissionError);

      await expect(
        service.cancelPostDispatch('projects/test/tasks/restricted')
      ).rejects.toThrow('Permission Denied');
    });
  });

  describe('getTaskScheduler factory', () => {
    it('retorna MockTaskScheduler en entorno test', () => {
      const scheduler = getTaskScheduler();
      expect(scheduler).toBeInstanceOf(MockTaskScheduler);
    });
  });
});
