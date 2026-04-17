import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PermissionError } from '../modules/permissions/permissionService';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ValidationError', details: err.errors });
    return;
  }
  if (err instanceof PermissionError) {
    res.status(403).json({ error: 'PermissionDenied', denied: err.denied });
    return;
  }
  res.status(500).json({ error: 'InternalError', message: String((err as any)?.message ?? err) });
}
