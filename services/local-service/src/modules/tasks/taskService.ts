import type { PrismaClient, Task } from '@prisma/client';
import type { TaskCreateInput, TaskDTO, TaskStatus, PermissionKey } from '@openclaw/shared';
import { taskCreateSchema } from '@openclaw/shared';
import type { SettingsService } from '../../services/settingsService';
import type { PermissionService } from '../permissions/permissionService';
import type { TaskLogService } from './taskLogService';
import type { OpenClawAdapter, AdapterEvent } from '../../openclaw/adapter';
import { SseHub } from '../../realtime/sse';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { getSessionsDir, normalizeAgentName, resolveSessionFile } from '../sessions/sessionStore';

type TaskMeta = {
  requiredPermissions: PermissionKey[];
  agentName: string | null;
};

export class TaskService {
  constructor(
    private prisma: PrismaClient,
    private settingsService: SettingsService,
    private permissionService: PermissionService,
    private taskLogService: TaskLogService,
    private adapter: OpenClawAdapter,
    private sse: SseHub
  ) { }

  async createTask(input: TaskCreateInput & { agentName?: string | null }): Promise<TaskDTO> {
    const normalizedAgentName = normalizeAgentName(input.agentName);
    const sessionId = input.sessionId;
    const parsed = taskCreateSchema.parse({
      title: input.title,
      input: input.input,
      requiredPermissions: input.requiredPermissions,
    });
    const requiredPermissions = parsed.requiredPermissions ?? [];

    await this.permissionService.assert(requiredPermissions);

    const task = await this.prisma.task.create({
      data: {
        title: parsed.title ?? null,
        input: parsed.input,
        status: 'QUEUED',
        requiredPermissionsJson: JSON.stringify({
          requiredPermissions,
          agentName: normalizedAgentName,
        }),
      },
    });

    this.sse.broadcast({ type: 'task.created', payload: this.toDto(task) });

    const config = await this.settingsService.getInternal();
    const handle = await this.adapter.submitTask(
      {
        taskId: task.id,
        title: parsed.title,
        input: parsed.input,
        sessionId: sessionId ?? null,
        agentName: normalizedAgentName,
      },
      { config }
    );

    await this.prisma.task.update({
      where: { id: task.id },
      data: { status: 'RUNNING', startedAt: new Date(), externalTaskId: handle.externalTaskId },
    });

    if (sessionId) {
      this.sse.broadcast({
        type: 'session.updated',
        payload: { sessionId, agentName: normalizedAgentName, taskId: task.id, phase: 'started', at: new Date().toISOString() },
      });
    }

    void this.consumeEvents(task.id, handle.eventStream, sessionId, normalizedAgentName);

    return this.getTask(task.id);
  }

  async listTasks(): Promise<TaskDTO[]> {
    const items = await this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
    return items.map((t) => this.toDto(t));
  }

  async getTask(id: string): Promise<TaskDTO> {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    return this.toDto(task);
  }

  async getTaskLogs(id: string) {
    return this.taskLogService.list(id);
  }

  private parseTaskMeta(task: Task): TaskMeta {
    if (!task.requiredPermissionsJson) {
      return { requiredPermissions: [], agentName: null };
    }
    try {
      const parsed = JSON.parse(task.requiredPermissionsJson) as unknown;
      if (Array.isArray(parsed)) {
        return { requiredPermissions: parsed as PermissionKey[], agentName: null };
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as {
          requiredPermissions?: unknown;
          agentName?: unknown;
        };
        const requiredPermissions = Array.isArray(obj.requiredPermissions)
          ? (obj.requiredPermissions as PermissionKey[])
          : [];
        const agentName = typeof obj.agentName === 'string' && obj.agentName.trim() ? obj.agentName : null;
        return { requiredPermissions, agentName };
      }
    } catch {
      // Keep backward compatibility if old or invalid data exists.
    }
    return { requiredPermissions: [], agentName: null };
  }

  private toDto(task: Task): TaskDTO {
    const meta = this.parseTaskMeta(task);
    return {
      id: task.id,
      title: task.title,
      input: task.input,
      agentName: meta.agentName,
      status: task.status.toLowerCase() as TaskStatus,
      requiredPermissions: meta.requiredPermissions,
      externalTaskId: task.externalTaskId,
      result: task.resultJson ? JSON.parse(task.resultJson) : null,
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private async consumeEvents(
    taskId: string,
    stream: AsyncIterable<AdapterEvent>,
    sessionId?: string | null,
    agentName = 'main'
  ) {
    const emitSessionUpdated = (phase: string) => {
      if (!sessionId) return;
      this.sse.broadcast({
        type: 'session.updated',
        payload: {
          sessionId,
          agentName,
          taskId,
          phase,
          at: new Date().toISOString(),
        },
      });
    };

    const heartbeat: NodeJS.Timeout | null = sessionId
      ? setInterval(() => {
          emitSessionUpdated('heartbeat');
        }, 700)
      : null;

    try {
      for await (const event of stream) {
        emitSessionUpdated(`event:${event.type}`);

        if (event.type === 'log') {
          await this.taskLogService.append(taskId, event.level, event.message, event.meta);
        }
        if (event.type === 'result') {
          await this.prisma.task.update({
            where: { id: taskId },
            data: { resultJson: event.output ? JSON.stringify(event.output) : null },
          });
          // Write to session file if sessionId is provided
          if (sessionId) {
            this.appendToSessionFile(sessionId, {
              type: 'message',
              id: `task-${taskId}-result`,
              timestamp: new Date().toISOString(),
              message: {
                role: 'assistant',
                content: event.output ? JSON.stringify(event.output, null, 2) : 'No result',
              },
            }, agentName);
            emitSessionUpdated('result-appended');
          }
        }
        if (event.type === 'status') {
          const data: any = { status: event.status.toUpperCase() as any };
          if (['succeeded', 'failed', 'cancelled'].includes(event.status)) {
            data.completedAt = new Date();
          }
          if (event.status === 'failed' && event.message) {
            data.errorMessage = event.message;
          }
          const updated = await this.prisma.task.update({ where: { id: taskId }, data });
          this.sse.broadcast({ type: 'task.updated', payload: this.toDto(updated) });
          emitSessionUpdated(`status:${event.status}`);
        }
      }
    } catch (err: any) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: String(err?.message ?? err) },
      });
      emitSessionUpdated('status:failed');
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      emitSessionUpdated('completed');
    }
  }

  private appendToSessionFile(sessionId: string, event: Record<string, any>, agentName = 'main') {
    try {
      const sessionsDir = getSessionsDir(agentName);
      if (!existsSync(sessionsDir)) {
        mkdirSync(sessionsDir, { recursive: true });
      }

      const eventFile = resolveSessionFile(sessionId, undefined, agentName);

      appendFileSync(eventFile, JSON.stringify(event) + '\n', 'utf-8');
      console.log(`Appended event to session file: ${eventFile}`);
    } catch (err) {
      console.error(`Failed to append to session file for ${sessionId}:`, err);
    }
  }
}
