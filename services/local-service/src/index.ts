import { env } from './config/env';
import { ensureDir } from './utils/fs';
import { prisma } from './prisma/client';
import { SseHub } from './realtime/sse';
import { SettingsService } from './services/settingsService';
import { PermissionService } from './modules/permissions/permissionService';
import { TaskLogService } from './modules/tasks/taskLogService';
import { TaskService } from './modules/tasks/taskService';
import { createOpenClawAdapter } from './openclaw/factory';
import { createApp } from './app';
import { ensureOpenClawInstalled, runNonInteractiveOnboarding, startGateway, readGatewayToken } from './openclaw/installer';

async function main() {
  ensureDir(env.appDataDir);

  await prisma.$connect();

  if (env.openclawMode === 'real') {
    await ensureOpenClawInstalled({
      binaryName: env.openclawBinary,
      installScriptSh: env.openclawInstallSh,
      installScriptPs: env.openclawInstallPs,
    });

    const existingToken = readGatewayToken();
    if (existingToken) {
      process.env.OPENCLAW_GATEWAY_TOKEN = existingToken;
    } else {
      await runNonInteractiveOnboarding(env.openclawOnboardCmd);
    }
    await startGateway(env.openclawGatewayCmd);
  }

  const sseHub = new SseHub();
  const settingsService = new SettingsService(prisma, sseHub);
  const permissionService = new PermissionService(prisma, sseHub);
  const taskLogService = new TaskLogService(prisma, sseHub);
  const adapter = createOpenClawAdapter(env.openclawMode);

  if (env.openclawMode === 'real') {
    try {
      const initialConfig = await settingsService.getInternal();
      await adapter.syncLocalConfig(initialConfig, {
        // Gateway is already started above (startGateway), skip redundant restart here.
        skipGatewayRestart: true,
      });
    } catch (error) {
      console.warn(`[openclaw] initial config sync failed: ${String((error as Error)?.message ?? error)}`);
    }
  }

  const taskService = new TaskService(
    prisma,
    settingsService,
    permissionService,
    taskLogService,
    adapter,
    sseHub
  );

  const app = createApp({
    env,
    prisma,
    sseHub,
    settingsService,
    permissionService,
    taskService,
    adapter,
  });

  console.log('DATABASE_URL=', process.env.DATABASE_URL);
  app.listen(env.port, () => {
    console.log(`Local service running at http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
