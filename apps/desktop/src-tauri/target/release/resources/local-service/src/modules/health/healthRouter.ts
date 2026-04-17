import { Router } from 'express';
import type { Env } from '../../config/env';
import type { OpenClawAdapter } from '../../openclaw/adapter';

export function createHealthRouter(env: Env, adapter: OpenClawAdapter): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const agent = await adapter.getAgentHealth();
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      openclawMode: env.openclawMode,
      agent,
    });
  });

  return router;
}
