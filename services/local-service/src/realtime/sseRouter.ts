import { Router } from 'express';
import type { SseHub } from './sse';

export function createSseRouter(sse: SseHub): Router {
  const router = Router();

  router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const id = sse.addClient(res);
    req.on('close', () => sse.removeClient(id));
  });

  return router;
}
