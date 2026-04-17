import os from 'os';
import path from 'path';
import type { LocalConfigInput } from '@openclaw/shared';

function isChineseLocale(): boolean {
  const locale =
    Intl.DateTimeFormat().resolvedOptions().locale ||
    process.env.LANG ||
    process.env.LC_ALL ||
    '';
  return locale.toLowerCase().startsWith('zh');
}

export function defaultWorkDir(): string {
  const folderName = isChineseLocale() ? 'OpenClaw工作区' : 'OpenClaw';
  return path.join(os.homedir(), folderName);
}

export function defaultLocalConfig(): LocalConfigInput {
  return {
    modelMode: 'builtin',
    apiKey: null,
    baseUrl: null,
    customModelName: null,
    modelName: 'openai/gpt-4o',
    workDirAuto: true,
    workDir: defaultWorkDir(),
    notificationsEnabled: true,
  };
}
