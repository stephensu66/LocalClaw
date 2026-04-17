import { Router } from 'express';
import { z } from 'zod';
import type { SetupService } from './setupService';

const setupUpdateSchema = z.object({
  consent: z
    .object({
      nodeInstall: z.boolean().optional(),
      openclawInstall: z.boolean().optional(),
    })
    .optional(),
  paths: z
    .object({
      openclawInstallDir: z.string().trim().min(1).nullable().optional(),
      workDir: z.string().trim().min(1).nullable().optional(),
    })
    .optional(),
});

export function createSetupRouter(setupService: SetupService): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    res.json(await setupService.getStatus());
  });

  router.put('/state', async (req, res) => {
    const parsed = setupUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }
    res.json(await setupService.updateState(parsed.data));
  });

  router.post('/run', async (req, res) => {
    const parsed = setupUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }
    res.json(await setupService.run(parsed.data));
  });

  return router;
}
