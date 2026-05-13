#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '../..');
const localServiceSrcDir = path.resolve(repoRoot, 'services/local-service');
const resourcesDir = path.resolve(desktopDir, 'src-tauri/resources');
const localServiceOutDir = path.resolve(resourcesDir, 'local-service');

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${rendered}`);
  }
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

  run('pnpm', ['--filter', '@openclaw/shared', 'build']);
  run('pnpm', ['--filter', '@openclaw/local-service', 'prisma:generate']);
  run('pnpm', ['--filter', '@openclaw/local-service', 'build']);

  copyRuntimeFiles();
  copyPrismaRuntimeDeps();

  console.log('[desktop] runtime prepared');
  console.log(`[desktop] local-service: ${localServiceOutDir}`);
}

main();
