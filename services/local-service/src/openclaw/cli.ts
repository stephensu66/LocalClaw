import { spawn } from 'child_process';
import { buildOpenClawProcessEnv, withNvmUse } from './runtimeEnv';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runCommand(command: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn(withNvmUse(command), {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildOpenClawProcessEnv(),
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    proc.on('error', () => resolve({ code: 1, stdout, stderr }));
  });
}
