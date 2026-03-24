import { Router } from 'express';
import { permissionKeySchema, permissionUpdateSchema } from '@openclaw/shared';
import type { PermissionService } from './permissionService';

export function createPermissionRouter(service: PermissionService): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await service.list());
  });

  router.put('/:key', async (req, res) => {
    const key = permissionKeySchema.parse(req.params.key);
    const body = permissionUpdateSchema.parse(req.body);
    const updated = await service.set(key, body.granted, body.scope ?? null);
    res.json(updated);
  });

  return router;
}
