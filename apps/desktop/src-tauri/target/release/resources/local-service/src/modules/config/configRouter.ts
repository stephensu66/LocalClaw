import { Router } from 'express';
import { exec } from 'child_process';
import type { SettingsService } from '../../services/settingsService';
import type { OpenClawAdapter } from '../../openclaw/adapter';

export function createConfigRouter(settings: SettingsService, adapter: OpenClawAdapter): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await settings.getView());
  });

  router.put('/', async (req, res) => {
    const view = await settings.update(req.body);
    const internal = await settings.getInternal();
    await adapter.syncLocalConfig(internal);
    res.json(view);
  });

  router.post('/switch-to-openclaw', async (_req, res) => {
    exec('openclaw dashboard', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing openclaw dashboard: ${error}`);
        return res.status(500).json({ error: 'Failed to switch to OpenClaw dashboard' });
      }
      console.log(`openclaw dashboard stdout: ${stdout}`);
      if (stderr) console.error(`openclaw dashboard stderr: ${stderr}`);
      res.json({ success: true });
    });
  });

  return router;
}
