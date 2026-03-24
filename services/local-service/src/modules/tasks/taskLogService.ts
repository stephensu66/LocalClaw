import type { PrismaClient } from '@prisma/client';
import type { LogLevel, TaskLogDTO } from '@openclaw/shared';
import { SseHub } from '../../realtime/sse';

export class TaskLogService {
  constructor(private prisma: PrismaClient, private sse: SseHub) {}

  async append(taskId: string, level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<TaskLogDTO> {
    const log = await this.prisma.taskLog.create({
      data: {
        taskId,
        level: level.toUpperCase() as any,
        message,
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    });

    const dto: TaskLogDTO = {
      id: log.id,
      taskId: log.taskId,
      level,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    };

    this.sse.broadcast({ type: 'task.log', payload: dto });
    return dto;
  }

  async list(taskId: string): Promise<TaskLogDTO[]> {
    const logs = await this.prisma.taskLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    return logs.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      level: log.level.toLowerCase() as LogLevel,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
