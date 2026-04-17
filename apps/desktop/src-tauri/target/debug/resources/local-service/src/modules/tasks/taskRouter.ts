import { Router } from 'express';
import type { TaskService } from './taskService';

export function createTaskRouter(service: TaskService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const task = await service.createTask(req.body);
    res.json(task);
  });

  router.get('/', async (_req, res) => {
    res.json(await service.listTasks());
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.getTask(req.params.id));
  });

  router.get('/:id/logs', async (req, res) => {
    res.json(await service.getTaskLogs(req.params.id));
  });

  return router;
}
