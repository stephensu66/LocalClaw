#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '../..');
const localServiceSrcDir = path.resolve(repoRoot, 'services/local-service');
const resourcesDir = path.resolve(desktopDir, 'src-tauri/resources');
const localServiceOutDir = path.resolve(resourcesDir, 'local-service');

function run(command, args, cwd = repoRoot) {
  const rendered = [command, ...args].join(' ');
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    throw new Error(`Command failed to start: ${rendered}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }
}

function resolvePackageBin(packageName, binName, cwd) {
  const requireFromPackage = createRequire(path.join(cwd, 'package.json'));
  const packageJsonPath = requireFromPackage.resolve(`${packageName}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) {
    throw new Error(`Unable to resolve ${binName} bin for package ${packageName}`);
  }

  return path.resolve(packageDir, bin);
}

function runPackageBin(packageName, binName, args, cwd) {
  const binPath = resolvePackageBin(packageName, binName, cwd);
  run(process.execPath, [binPath, ...args], cwd);
}

function cleanAndPrepareDirs() {
  rmSync(localServiceOutDir, { recursive: true, force: true });
  mkdirSync(localServiceOutDir, { recursive: true });
  mkdirSync(path.resolve(localServiceOutDir, 'node_modules', '@prisma'), { recursive: true });
}

function copyRuntimeFiles() {
  const entriesToCopy = [
    '.env.example',
    'package.json',
    'dist',
    'prisma',
    'openclaw-skills',
  ];

  for (const entry of entriesToCopy) {
    const source = path.resolve(localServiceSrcDir, entry);
    const destination = path.resolve(localServiceOutDir, entry);
    cpSync(source, destination, {
      recursive: true,
      force: true,
      dereference: true,
    });
  }

  const envSource = path.resolve(localServiceSrcDir, '.env');
  if (existsSync(envSource)) {
    cpSync(envSource, path.resolve(localServiceOutDir, '.env'), {
      force: true,
      dereference: true,
    });
  }
}

function copyPrismaRuntimeDeps() {
  const prismaClientReal = realpathSync(path.resolve(localServiceSrcDir, 'node_modules', '@prisma', 'client'));
  const prismaGeneratedReal = path.resolve(prismaClientReal, '..', '..', '.prisma');

  cpSync(prismaClientReal, path.resolve(localServiceOutDir, 'node_modules', '@prisma', 'client'), {
    recursive: true,
    force: true,
    dereference: true,
  });

  cpSync(prismaGeneratedReal, path.resolve(localServiceOutDir, 'node_modules', '.prisma'), {
    recursive: true,
    force: true,
    dereference: true,
  });
}

function main() {
  cleanAndPrepareDirs();

  runPackageBin('typescript', 'tsc', ['-p', path.resolve(repoRoot, 'packages/shared/tsconfig.json')], repoRoot);
  runPackageBin('prisma', 'prisma', ['generate'], localServiceSrcDir);
  runPackageBin('tsup', 'tsup', ['--config', 'tsup.config.ts'], localServiceSrcDir);

  copyRuntimeFiles();
  copyPrismaRuntimeDeps();

  console.log('[desktop] runtime prepared');
  console.log(`[desktop] local-service: ${localServiceOutDir}`);
}

main();
