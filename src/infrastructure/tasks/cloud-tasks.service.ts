/**
 * @file cloud-tasks.service.ts
 * @description Servicio de infraestructura para encolado, programación y cancelación
 * de tareas en Google Cloud Tasks. Provee TaskScheduler y MockTaskScheduler.
 */

import { CloudTasksClient } from '@google-cloud/tasks';

export interface ScheduleTaskOptions {
  postId: string;
  idempotencyKey: string;
  scheduledAt: string; // ISO-8601 UTC
  workerUrl?: string;
  payload?: Record<string, unknown>;
}

export interface ScheduledTaskResult {
  taskName: string;
}

export interface TaskScheduler {
  schedulePostDispatch(options: ScheduleTaskOptions): Promise<ScheduledTaskResult>;
  cancelPostDispatch(taskName: string): Promise<boolean>;
}

export class MockTaskScheduler implements TaskScheduler {
  public scheduledTasks = new Map<string, { options: ScheduleTaskOptions; cancelled: boolean }>();
  public shouldFailSchedule = false;
  public shouldFailCancel = false;

  async schedulePostDispatch(options: ScheduleTaskOptions): Promise<ScheduledTaskResult> {
    if (this.shouldFailSchedule) {
      throw new Error('MockTaskScheduler: error simulado al programar tarea');
    }

    const taskName = `projects/mock-project/locations/mock-location/queues/mock-queue/tasks/mock-task-${options.postId}-${Date.now()}`;
    this.scheduledTasks.set(taskName, { options, cancelled: false });
    return { taskName };
  }

  async cancelPostDispatch(taskName: string): Promise<boolean> {
    if (this.shouldFailCancel) {
      throw new Error('MockTaskScheduler: error simulado al cancelar tarea');
    }

    const task = this.scheduledTasks.get(taskName);
    if (!task) {
      return false;
    }

    task.cancelled = true;
    return true;
  }

  getTask(taskName: string) {
    return this.scheduledTasks.get(taskName);
  }

  clear(): void {
    this.scheduledTasks.clear();
  }
}

export interface CloudTasksServiceConfig {
  projectId?: string;
  location?: string;
  queue?: string;
  workerUrl?: string;
  serviceAccountEmail?: string;
  authSecret?: string;
  client?: CloudTasksClient;
}

export class CloudTasksService implements TaskScheduler {
  private readonly client: CloudTasksClient;
  private readonly projectId: string;
  private readonly location: string;
  private readonly queue: string;
  private readonly defaultWorkerUrl: string;
  private readonly serviceAccountEmail?: string;
  private readonly authSecret?: string;

  constructor(config?: CloudTasksServiceConfig) {
    this.client = config?.client ?? new CloudTasksClient();
    this.projectId =
      config?.projectId ||
      process.env.CLOUD_TASKS_PROJECT_ID ||
      process.env.GCP_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      'social-ops-dashboard-dev';
    this.location = config?.location || process.env.CLOUD_TASKS_LOCATION || 'us-central1';
    this.queue = config?.queue || process.env.CLOUD_TASKS_QUEUE || 'social-ops-dispatch-queue';
    this.defaultWorkerUrl =
      config?.workerUrl ||
      process.env.CLOUD_TASKS_WORKER_URL ||
      `${process.env.APP_URL || 'https://localhost:3000'}/api/tasks/dispatch-post`;
    this.serviceAccountEmail =
      config?.serviceAccountEmail || process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL;
    this.authSecret = config?.authSecret || process.env.TASKS_AUTH_SECRET;
  }

  async schedulePostDispatch(options: ScheduleTaskOptions): Promise<ScheduledTaskResult> {
    const parent = this.client.queuePath(this.projectId, this.location, this.queue);
    const workerUrl = options.workerUrl || this.defaultWorkerUrl;
    const scheduleDate = new Date(options.scheduledAt);
    const scheduleTimeSeconds = Math.floor(scheduleDate.getTime() / 1000);

    const httpPayload = {
      postId: options.postId,
      idempotencyKey: options.idempotencyKey,
      ...options.payload,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authSecret) {
      headers['Authorization'] = `Bearer ${this.authSecret}`;
    }

    const taskPayload: {
      httpRequest: {
        httpMethod: 'POST';
        url: string;
        headers: Record<string, string>;
        body: string;
        oidcToken?: {
          serviceAccountEmail: string;
          audience: string;
        };
      };
      scheduleTime: {
        seconds: number;
      };
    } = {
      httpRequest: {
        httpMethod: 'POST',
        url: workerUrl,
        headers,
        body: Buffer.from(JSON.stringify(httpPayload)).toString('base64'),
      },
      scheduleTime: {
        seconds: scheduleTimeSeconds,
      },
    };

    if (this.serviceAccountEmail) {
      taskPayload.httpRequest.oidcToken = {
        serviceAccountEmail: this.serviceAccountEmail,
        audience: workerUrl,
      };
    }

    const [response] = await this.client.createTask({
      parent,
      task: taskPayload,
    });

    if (!response.name) {
      throw new Error('Cloud Tasks no devolvió un identificador de tarea válido.');
    }

    return { taskName: response.name };
  }

  async cancelPostDispatch(taskName: string): Promise<boolean> {
    try {
      await this.client.deleteTask({ name: taskName });
      return true;
    } catch (error: unknown) {
      // Código gRPC 5 NOT_FOUND: la tarea ya fue ejecutada o cancelada previamente
      const err = error as { code?: number; status?: number };
      if (err?.code === 5 || err?.status === 5) {
        return false;
      }
      throw error;
    }
  }
}

export function getTaskScheduler(): TaskScheduler {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.USE_MOCK_TASKS === 'true' ||
    process.env.FIRESTORE_EMULATOR_HOST
  ) {
    return new MockTaskScheduler();
  }
  return new CloudTasksService();
}
