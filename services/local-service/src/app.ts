import express from 'express';
import cors from 'cors';
import type { Env } from './config/env';
import type { PrismaClient } from '@prisma/client';
import type { SseHub } from './realtime/sse';
import type { SettingsService } from './services/settingsService';
import type { PermissionService } from './modules/permissions/permissionService';
import type { TaskService } from './modules/tasks/taskService';
import type { OpenClawAdapter } from './openclaw/adapter';
import { createConfigRouter } from './modules/config/configRouter';
import { createTaskRouter } from './modules/tasks/taskRouter';
import { createPermissionRouter } from './modules/permissions/permissionRouter';
import { createAgentRouter } from './modules/agent/agentRouter';
import { createHealthRouter } from './modules/health/healthRouter';
import { createSessionRouter } from './modules/sessions/sessionRouter';
import { createSetupRouter } from './modules/setup/setupRouter';
import { createSseRouter } from './realtime/sseRouter';
import { errorMiddleware } from './middleware/errorMiddleware';
import type { SetupService } from './modules/setup/setupService';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function createApp(ctx: {
  env: Env;
  prisma: PrismaClient;
  sseHub: SseHub;
  settingsService: SettingsService;
  permissionService: PermissionService;
  taskService: TaskService;
  setupService: SetupService;
  adapter: OpenClawAdapter;
}) {
  const app = express();
  const configuredOrigins = new Set(ctx.env.allowedOrigins);

  app.use(express.json({ limit: '2mb' }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (configuredOrigins.has(origin) || isLoopbackOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
    })
  );

  app.get('/', (_req, res) => {
    res.json({
      message: 'OpenClaw Local Service is running.',
      health: '/api/health',
      config: '/api/config',
      tasks: '/api/tasks',
      permissions: '/api/permissions',
      agent: '/api/agent/status',
      setup: '/api/setup/status',
      events: '/api/events',
    });
  });

  app.use('/api/health', createHealthRouter(ctx.env, ctx.adapter));
  app.use('/api/sessions', createSessionRouter(ctx.env));
  app.use('/api/config', createConfigRouter(ctx.settingsService, ctx.adapter));
  app.use('/api/tasks', createTaskRouter(ctx.taskService));
  app.use('/api/permissions', createPermissionRouter(ctx.permissionService));
  app.use('/api/agent', createAgentRouter(ctx.adapter));
  app.use('/api/setup', createSetupRouter(ctx.setupService));
  app.use('/api/events', createSseRouter(ctx.sseHub));

  app.use(errorMiddleware);

  return app;
}
