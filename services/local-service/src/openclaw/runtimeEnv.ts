import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function resolvePathKey(env: NodeJS.ProcessEnv): string {
  if (typeof env.PATH === 'string') return 'PATH';
  const matched = Object.keys(env).find((key) => key.toLowerCase() === 'path');
  return matched ?? 'PATH';
}

function prependPath(env: NodeJS.ProcessEnv, dir: string): NodeJS.ProcessEnv {
  if (!dir.trim()) return env;
  const key = resolvePathKey(env);
  const delimiter = path.delimiter;
  const current = env[key] ?? '';
  const items = current
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  const nextItems = [dir, ...items.filter((item) => item !== dir)];
  return {
    ...env,
    [key]: nextItems.join(delimiter),
  };
}

function resolvePathList(rawPath: string): string[] {
  return rawPath
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function nodeRequiredMajor(): number {
  const parsed = Number.parseInt(process.env.NODE_REQUIRED_MAJOR ?? '24', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function resolveRuntimeNodePath(): string {
  const configured = process.env.LOCAL_SERVICE_NODE_PATH?.trim();
  if (configured) return configured;
  return process.execPath;
}

export function withNvmUse(command: string): string {
  if (process.platform === 'win32') return command;
  const requiredMajor = nodeRequiredMajor();
  return [
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"',
    'if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; nvm use ' + requiredMajor + ' >/dev/null 2>&1 || true; fi',
    command,
  ].join('; ');
}

export function buildOpenClawProcessEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = {
    ...process.env,
    ...(extra ?? {}),
  };
  const runtimeNodePath = resolveRuntimeNodePath();
  const runtimeNodeDir = path.dirname(runtimeNodePath);
  const envWithPath = prependPath(merged, runtimeNodeDir);
  return {
    ...envWithPath,
    LOCAL_SERVICE_NODE_PATH: runtimeNodePath,
  };
}

function resolveCommandPath(command: string, env: NodeJS.ProcessEnv): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return trimmed;
  }
  if (process.platform === 'win32') {
    const output = spawnSync('where', [trimmed], { env, encoding: 'utf8' });
    if (output.status !== 0) return null;
    const firstLine = output.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return firstLine ?? null;
  }
  const output = spawnSync('sh', ['-lc', `command -v ${shellEscape(trimmed)}`], { env, encoding: 'utf8' });
  if (output.status !== 0) return null;
  const resolved = output.stdout.trim();
  return resolved || null;
}

function readTextPrefix(filePath: string, bytes = 8192): string | null {
  try {
    const realPath = fs.realpathSync(filePath);
    const handle = fs.openSync(realPath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const read = fs.readSync(handle, buffer, 0, bytes, 0);
      return buffer.slice(0, read).toString('utf8');
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    return null;
  }
}

function isNodeShebangScript(filePath: string): boolean {
  const text = readTextPrefix(filePath, 256);
  if (!text) return false;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.startsWith('#!') && firstLine.toLowerCase().includes('node');
}

function extractNodeScriptFromShellWrapper(filePath: string): string | null {
  const text = readTextPrefix(filePath);
  if (!text) return null;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  if (!firstLine.startsWith('#!') || !/(bash|sh)/i.test(firstLine)) return null;

  const quotedMatch = text.match(/exec\s+["']?[^"'\s]*node[^"'\s]*["']?\s+["']([^"']+)["']/i);
  const unquotedMatch = text.match(/exec\s+["']?[^"'\s]*node[^"'\s]*["']?\s+([^\s"'`]+)/i);
  const scriptPath = quotedMatch?.[1] ?? unquotedMatch?.[1];
  if (!scriptPath) return null;
  if (!path.isAbsolute(scriptPath)) return null;
  if (!fs.existsSync(scriptPath)) return null;
  return scriptPath;
}

export function buildOpenClawLaunch(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv
): { program: string; args: string[]; command: string[] } {
  const runtimeNodePath = resolveRuntimeNodePath();
  const runtimeNodeDir = path.dirname(runtimeNodePath);
  const envPathKey = resolvePathKey(env);
  const envPathList = resolvePathList(env[envPathKey] ?? '');
  const hasRuntimeNodeInPath = envPathList.includes(runtimeNodeDir);

  if (!hasRuntimeNodeInPath) {
    // Keep launch behavior deterministic: runtime node directory must be prepended.
    env[envPathKey] = [runtimeNodeDir, ...envPathList].join(path.delimiter);
  }

  const resolvedBinary = resolveCommandPath(binary, env) ?? binary;
  if (isNodeShebangScript(resolvedBinary)) {
    const command = [runtimeNodePath, resolvedBinary, ...args];
    return { program: runtimeNodePath, args: [resolvedBinary, ...args], command };
  }

  const wrappedScript = extractNodeScriptFromShellWrapper(resolvedBinary);
  if (wrappedScript) {
    const command = [runtimeNodePath, wrappedScript, ...args];
    return { program: runtimeNodePath, args: [wrappedScript, ...args], command };
  }

  const command = [resolvedBinary, ...args];
  return { program: resolvedBinary, args, command };
}
