import { z } from 'zod';

export const modelModeSchema = z.enum([
  'builtin',
  'local_model',
  'deepseek',
  'alibaba_cloud',
  'moonshot',
  'zhipu',
  'minimax',
  'baidu',
  'tencent_hunyuan',
  'openai',
  'anthropic',
  'google',
  'groq',
  'together_ai',
  'fireworks_ai',
  'perplexity',
  'other',
]);

export const permissionKeySchema = z.enum([
  'FILE_READ',
  'FILE_WRITE',
  'SHELL_EXEC',
  'PYTHON_EXEC',
  'INTERNET_ACCESS',
  'BROWSER',
]);

const localConfigBaseSchema = z.object({
  modelMode: modelModeSchema,
  apiKey: z.string().min(1).optional().nullable(),
  baseUrl: z.string().url().optional().nullable(),
  customModelName: z.string().min(1).optional().nullable(),
  modelName: z.string().min(1).default('anthropic/claude-opus-4-6'),
  workDirAuto: z.boolean().default(true),
  workDir: z.string().min(1),
  notificationsEnabled: z.boolean(),
});

export const localConfigInputSchema = localConfigBaseSchema.superRefine((val, ctx) => {
  if (val.modelMode === 'other') {
    if (!val.customModelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom model name is required for Other mode',
        path: ['customModelName'],
      });
    }
    if (!val.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Base URL is required for Other mode',
        path: ['baseUrl'],
      });
    }
  }
});

export const localConfigUpdateSchema = localConfigBaseSchema.partial().superRefine((val, ctx) => {
  if (val.modelMode === 'other') {
    if ('customModelName' in val && !val.customModelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom model name is required for Other mode',
        path: ['customModelName'],
      });
    }
    if ('baseUrl' in val && !val.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Base URL is required for Other mode',
        path: ['baseUrl'],
      });
    }
  }
});

export const taskCreateSchema = z.object({
  title: z.string().max(100).optional(),
  input: z.string().min(1),
  requiredPermissions: z.array(permissionKeySchema).optional(),
  sessionId: z.string().optional().nullable(),
});

export const permissionUpdateSchema = z.object({
  granted: z.boolean(),
  scope: z.record(z.unknown()).optional(),
});
