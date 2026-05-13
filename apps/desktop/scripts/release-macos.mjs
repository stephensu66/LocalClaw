#!/usr/bin/env node

import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '../..');
const tauriDir = path.resolve(desktopDir, 'src-tauri');
const tauriBundleDir = path.resolve(tauriDir, 'target/release/bundle');
const requiredNodeMajor = Number.parseInt(process.env.NODE_REQUIRED_MAJOR ?? '24', 10);

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const {
    cwd = repoRoot,
    capture = false,
    env = process.env,
  } = options;

  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    if (capture) {
      const stderr = (result.stderr ?? '').trim();
      throw new Error(`Command failed (${result.status ?? 'unknown'}): ${rendered}${stderr ? `\n${stderr}` : ''}`);
    }
    throw new Error(`Command failed (${result.status ?? 'unknown'}): ${rendered}`);
  }

  return capture ? (result.stdout ?? '').trim() : '';
}

function shellQuote(input) {
  return `'${String(input).replace(/'/g, `'\\''`)}'`;
}

function parseNodeMajor(versionText) {
  return Number.parseInt(versionText.trim().replace(/^v/, '').split('.')[0] ?? '', 10);
}

function ensureCommand(command) {
  try {
    run('sh', ['-lc', `command -v ${command} >/dev/null 2>&1`], { capture: false });
  } catch {
    fail(`Missing required command: ${command}`);
  }
}

function ensureAppleSiliconMac() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform !== 'darwin' || arch !== 'arm64') {
    fail(`This release script only supports Apple Silicon macOS hosts. Current host: ${platform}/${arch}`);
  }
}

function ensureNodeVersion() {
  const nodeMajor = parseNodeMajor(process.version);
  if (nodeMajor !== requiredNodeMajor) {
    fail(`Node.js ${requiredNodeMajor}.x is required. Current version: ${process.version}`);
  }
}

function hasNotarizationEnv() {
  const appleIdFlow = process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID;
  const apiKeyFlow = process.env.APPLE_API_KEY && process.env.APPLE_API_ISSUER && process.env.APPLE_API_KEY_PATH;
  return Boolean(appleIdFlow || apiKeyFlow);
}

function ensureSigningEnv() {
  if (!process.env.APPLE_SIGNING_IDENTITY?.trim()) {
    fail('APPLE_SIGNING_IDENTITY is required for signed macOS builds.');
  }

  if (!hasNotarizationEnv()) {
    fail('Notarization credentials are required. Set APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID or APPLE_API_KEY/APPLE_API_ISSUER/APPLE_API_KEY_PATH.');
  }
}

function findNewestFile(rootDir, extension) {
  const matches = [];

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && fullPath.endsWith(extension)) {
        matches.push(fullPath);
      } else if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && fullPath.endsWith(extension)) {
        matches.push(fullPath);
      }
    }
  }

  walk(rootDir);

  if (matches.length === 0) {
    return null;
  }

  matches.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return matches[0];
}

function ensureArtifact(pathname, description) {
  if (!pathname || !existsSync(pathname)) {
    fail(`Unable to locate ${description}.`);
  }
}

function buildRelease() {
  run('cargo', ['tauri', 'build', '--ci', '--target', 'aarch64-apple-darwin', '--bundles', 'app,dmg'], { cwd: tauriDir });
}

function verifyArtifacts(appPath, dmgPath) {
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { cwd: repoRoot });
  run('spctl', ['--assess', '--type', 'execute', '-vv', appPath], { cwd: repoRoot });
  run('xcrun', ['stapler', 'validate', appPath], { cwd: repoRoot });
  run('xcrun', ['stapler', 'validate', dmgPath], { cwd: repoRoot });
}

function sha256(filePath) {
  const output = run('shasum', ['-a', '256', filePath], { capture: true });
  return output.split(/\s+/)[0];
}

function maybeShareArtifact(dmgPath) {
  const shareCommand = process.env.LOCALCLAW_SHARE_COMMAND?.trim();
  if (!shareCommand) {
    return null;
  }

  const rendered = shareCommand.includes('{file}')
    ? shareCommand.replaceAll('{file}', shellQuote(dmgPath))
    : `${shareCommand} ${shellQuote(dmgPath)}`;

  const output = run('sh', ['-lc', rendered], { capture: true, cwd: repoRoot });
  if (!output) {
    fail('LOCALCLAW_SHARE_COMMAND finished without printing a download URL.');
  }
  return output.split('\n').filter(Boolean).at(-1) ?? null;
}

function writeManifest({ appPath, dmgPath, dmgSha256, shareUrl }) {
  const manifestPath = path.join(tauriBundleDir, 'macos-release-manifest.json');
  const manifest = {
    generatedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    artifacts: {
      appPath,
      dmgPath,
      dmgSha256,
      shareUrl,
    },
    verify: {
      appLogPath: '~/Library/Logs/com.guodongsu.localclaw/local-service.log',
      installSteps: [
        'Open the DMG.',
        'Drag LocalClaw.app into /Applications.',
        'Launch LocalClaw from /Applications.',
        'Complete onboarding or open Settings and save the minimum required configuration.',
      ],
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function printSummary({ appPath, dmgPath, dmgSha256, shareUrl, manifestPath }) {
  console.log('');
  console.log('[release] Build complete.');
  console.log(`[release] app: ${appPath}`);
  console.log(`[release] dmg: ${dmgPath}`);
  console.log(`[release] sha256: ${dmgSha256}`);
  console.log(`[release] manifest: ${manifestPath}`);
  if (shareUrl) {
    console.log(`[release] share-url: ${shareUrl}`);
  } else {
    console.log('[release] share-url: not generated (set LOCALCLAW_SHARE_COMMAND to upload the DMG and print its URL)');
  }
  console.log('[release] Next validation target: clean Apple Silicon Mac -> download DMG -> install -> launch -> configure -> inspect ~/Library/Logs/com.guodongsu.localclaw/local-service.log if needed');
}

function main() {
  ensureAppleSiliconMac();
  ensureNodeVersion();
  ensureCommand('cargo');
  ensureCommand('codesign');
  ensureCommand('spctl');
  ensureCommand('xcrun');
  ensureCommand('shasum');
  ensureSigningEnv();

  buildRelease();

  const appPath = findNewestFile(path.join(tauriBundleDir, 'macos'), '.app');
  const dmgPath = findNewestFile(path.join(tauriBundleDir, 'dmg'), '.dmg');

  ensureArtifact(appPath, 'signed .app bundle');
  ensureArtifact(dmgPath, 'signed .dmg bundle');

  verifyArtifacts(appPath, dmgPath);

  const dmgSha256 = sha256(dmgPath);
  const shareUrl = maybeShareArtifact(dmgPath);
  const manifestPath = writeManifest({ appPath, dmgPath, dmgSha256, shareUrl });

  printSummary({ appPath, dmgPath, dmgSha256, shareUrl, manifestPath });
}

main();
