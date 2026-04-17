import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface InstallOptions {
  binaryName: string;
  installScriptSh: string;
  installScriptPs: string;
  onboardingCommand?: string;
  gatewayCommand?: string;
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function findOnPath(binaryName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = isWindows() ? 'where' : 'command';
    const args = isWindows() ? [binaryName] : ['-v', binaryName];
    const proc = spawn(cmd, args, { stdio: 'ignore' });

    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

function findLocalBinary(binaryName: string): string | null {
  const candidates = [
    path.join(process.cwd(), binaryName),
    path.join(process.cwd(), 'bin', binaryName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readGatewayToken(): string | null {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const data = readJsonFile(configPath);
  if (!data) return null;

  const direct =
    (data.gatewayToken as string) ||
    (data.gateway_token as string) ||
    (data.token as string) ||
    (data.authToken as string) ||
    (data.auth_token as string);
  if (direct) return direct;

  const gateway = data.gateway as Record<string, unknown> | undefined;
  const nested =
    (gateway?.token as string) ||
    (gateway?.gatewayToken as string) ||
    (gateway?.authToken as string);
  return nested ?? null;
}

async function runShell(command: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, {
      shell: true,
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command}`));
    });

    proc.on('error', reject);
  });
}

async function runCommand(cmd: string, args: string[] = [], detached = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      detached,
      shell: false,
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd} ${args.join(' ')}`));
    });

    proc.on('error', reject);

    if (detached) {
      proc.unref();
      resolve();
    }
  });
}

function hasAcceptRisk(command: string): boolean {
  return command.includes('--accept-risk');
}

export async function ensureOpenClawInstalled(opts: InstallOptions): Promise<void> {
  const foundLocal = findLocalBinary(opts.binaryName);
  const foundOnPath = await findOnPath(opts.binaryName);
  if (foundLocal || foundOnPath) return;

  if (isWindows()) {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr ${opts.installScriptPs} -UseB | iex -NoOnboard"`;
    await runShell(cmd);
  } else {
    const cmd = `bash -c "curl -fsSL ${opts.installScriptSh} | bash"`;
    await runShell(cmd);
  }
}

export async function runNonInteractiveOnboarding(command?: string): Promise<void> {
  if (!command) return;

  let finalCommand = command;

  if (!finalCommand.includes('--accept-risk')) {
    finalCommand += ' --accept-risk';
  }

  if (!finalCommand.includes('--install-daemon')) {
    finalCommand += ' --install-daemon';
  }

  await runShell(finalCommand);
}

export async function startGateway(command?: string): Promise<void> {
  if (!command) return;

  const proc = spawn(command, {
    shell: true,
    stdio: 'inherit',
    detached: true,
  });

  proc.unref();
}
