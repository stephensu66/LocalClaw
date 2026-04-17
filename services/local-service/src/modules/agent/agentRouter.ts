import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AgentCreateStepResult, OpenClawAdapter } from '../../openclaw/adapter';

const agentNamePattern = /^[a-zA-Z0-9_-]+$/;

const createAgentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Agent name is required')
    .regex(agentNamePattern, 'Agent name can only include letters, digits, "_" and "-"')
    .transform((value) => value.toLowerCase()),
  workspace: z.string().trim().min(1, 'Workspace is required'),
  agentDir: z.string().trim().min(1, 'Agent dir is required'),
  model: z.string().trim().min(1, 'Model is required'),
});

const getAgentModelQuerySchema = z.object({
  agentName: z
    .string()
    .trim()
    .min(1, 'Agent name is required')
    .regex(agentNamePattern, 'Agent name can only include letters, digits, "_" and "-"'),
});

const getAgentWorkspaceQuerySchema = z.object({
  agentName: z
    .string()
    .trim()
    .min(1, 'Agent name is required')
    .regex(agentNamePattern, 'Agent name can only include letters, digits, "_" and "-"'),
});

const setAgentModelSchema = z.object({
  agentName: z
    .string()
    .trim()
    .min(1, 'Agent name is required')
    .regex(agentNamePattern, 'Agent name can only include letters, digits, "_" and "-"'),
  model: z.string().trim().min(1, 'Model is required'),
});

type AgentCreateFailure = {
  step: string;
  code: string;
  message: string;
  stepResult: AgentCreateStepResult;
  steps: AgentCreateStepResult[];
};

type ModelListReason = 'not_configured' | 'timeout' | 'cli_unavailable' | 'error';

interface ModelListResponse {
  models: string[];
  ready: boolean;
  reason?: ModelListReason;
}

function isAgentCreateFailure(error: unknown): error is AgentCreateFailure {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<AgentCreateFailure>;
  return (
    typeof candidate.step === 'string' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    Boolean(candidate.stepResult) &&
    Array.isArray(candidate.steps)
  );
}

function statusFromCreateErrorCode(code: string): number {
  if (code === 'AGENT_EXISTS') return 409;
  if (code === 'MODEL_INVALID') return 400;
  if (code === 'PATH_PERMISSION_DENIED') return 403;
  if (code === 'CLI_NOT_FOUND') return 500;
  return 500;
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function classifyModelListFailure(error: unknown): {
  reason: ModelListReason;
  degraded: boolean;
  detail: string;
} {
  const detail = String((error as any)?.message ?? error ?? '').trim();
  const text = detail.toLowerCase();

  if (text.includes('timeout')) {
    return { reason: 'timeout', degraded: true, detail };
  }

  if (
    text.includes('enoent')
    || text.includes('command not found')
    || (text.includes('openclaw') && text.includes('not found'))
    || text.includes('cli unavailable')
  ) {
    return { reason: 'cli_unavailable', degraded: true, detail };
  }

  if (
    text.includes('api key')
    || text.includes('unauthorized')
    || text.includes('forbidden')
    || text.includes('401')
    || text.includes('403')
    || text.includes('not configured')
    || text.includes('missing')
    || text.includes('invalid model')
  ) {
    return { reason: 'not_configured', degraded: true, detail };
  }

  return { reason: 'error', degraded: false, detail };
}

export function createAgentRouter(adapter: OpenClawAdapter): Router {
  const router = Router();

  router.get('/status', asyncHandler(async (_req, res) => {
    res.json(await adapter.getAgentHealth());
  }));

  router.post('/env-check', asyncHandler(async (_req, res) => {
    res.json(await adapter.checkEnvironment());
  }));

  router.get('/list', asyncHandler(async (_req, res) => {
    const agents = await adapter.listAgents();
    res.json({ agents });
  }));

  router.get('/models', asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    console.info(
      JSON.stringify({
        scope: 'agent.models',
        event: 'start',
        startedAt: new Date(startedAt).toISOString(),
      })
    );

    try {
      const models = await adapter.listModels({ timeoutMs: 8_000 });
      const durationMs = Date.now() - startedAt;
      const ready = models.length > 0;
      const payload: ModelListResponse = {
        models,
        ready,
        ...(ready ? {} : { reason: 'not_configured' }),
      };

      console.info(
        JSON.stringify({
          scope: 'agent.models',
          event: 'finish',
          durationMs,
          ready,
          reason: payload.reason ?? null,
          modelsCount: models.length,
        })
      );
      res.json(payload);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const classified = classifyModelListFailure(error);

      console.warn(
        JSON.stringify({
          scope: 'agent.models',
          event: 'failed',
          durationMs,
          reason: classified.reason,
          degraded: classified.degraded,
          detail: classified.detail,
        })
      );

      if (classified.degraded) {
        const payload: ModelListResponse = {
          models: [],
          ready: false,
          reason: classified.reason,
        };
        res.json(payload);
        return;
      }

      throw error;
    }
  }));

  router.get('/model', asyncHandler(async (req, res) => {
    const parsed = getAgentModelQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }
    const result = await adapter.getAgentModel(parsed.data.agentName);
    res.json(result);
  }));

  router.get('/workspace', asyncHandler(async (req, res) => {
    const parsed = getAgentWorkspaceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }
    const result = await adapter.getAgentWorkspace(parsed.data.agentName);
    res.json(result);
  }));

  router.put('/model', asyncHandler(async (req, res) => {
    const parsed = setAgentModelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }

    const input = parsed.data;
    const existingAgents = await adapter.listAgents();
    if (!existingAgents.includes(input.agentName)) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'AGENT_NOT_FOUND',
      });
      return;
    }

    const models = await adapter.listModels();
    if (models.length === 0) {
      res.status(400).json({
        error: 'No available models found',
        code: 'MODEL_UNAVAILABLE',
      });
      return;
    }
    if (!models.includes(input.model)) {
      res.status(400).json({
        error: 'Selected model is not available',
        code: 'MODEL_INVALID',
      });
      return;
    }

    const result = await adapter.setAgentModel(input.agentName, input.model);
    res.json(result);
  }));

  router.post('/create', asyncHandler(async (req, res) => {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'ValidationError',
        details: parsed.error.issues,
      });
      return;
    }

    const input = parsed.data;
    const existingAgents = await adapter.listAgents();
    const hasDuplicate = existingAgents.some((name) => name.toLowerCase() === input.name);
    if (hasDuplicate) {
      res.status(409).json({
        error: 'Agent already exists',
        code: 'AGENT_EXISTS',
        step: 'create_agent',
      });
      return;
    }

    const models = await adapter.listModels();
    if (models.length === 0) {
      res.status(400).json({
        error: 'No available models found',
        code: 'MODEL_UNAVAILABLE',
        step: 'create_agent',
      });
      return;
    }

    if (!models.includes(input.model)) {
      res.status(400).json({
        error: 'Selected model is not available',
        code: 'MODEL_INVALID',
        step: 'create_agent',
      });
      return;
    }

    try {
      const result = await adapter.createAgent(input);
      res.json(result);
      return;
    } catch (error) {
      if (isAgentCreateFailure(error)) {
        res.status(statusFromCreateErrorCode(error.code)).json({
          error: error.message,
          code: error.code,
          step: error.step,
          stepResult: error.stepResult,
          steps: error.steps,
        });
        return;
      }
      throw error;
    }
  }));

  return router;
}
