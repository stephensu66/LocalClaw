import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(serviceRoot, '.env') });

function normalizeDatabasePath(databaseUrl?: string): string | null {
  const value = databaseUrl?.trim();
  if (!value || !value.startsWith('file:')) return null;

  const raw = value.slice('file:'.length).split('?')[0].trim();
  if (!raw) return null;

  if (raw.startsWith('//')) {
    return decodeURIComponent(raw.slice(2));
  }

  if (raw.startsWith('/')) {
    return decodeURIComponent(raw);
  }

  return path.resolve(serviceRoot, decodeURIComponent(raw));
}

function sqliteRelatedFiles(dbPath: string): string[] {
  return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { force: true });
    console.log(`removed: ${filePath}`);
  } catch (error) {
    console.warn(`skip: ${filePath} (${String((error as Error)?.message ?? error)})`);
  }
}

async function main() {
  const appDataDir = process.env.APP_DATA_DIR?.trim() || path.join(os.homedir(), '.openclaw');
  const databaseFromEnv = normalizeDatabasePath(process.env.DATABASE_URL);
  const defaultDatabase = path.join(appDataDir, 'openclaw.db');

  const targets = new Set<string>([
    ...sqliteRelatedFiles(defaultDatabase),
    path.join(appDataDir, 'secret.key'),
  ]);

  if (databaseFromEnv) {
    for (const filePath of sqliteRelatedFiles(databaseFromEnv)) {
      targets.add(filePath);
    }
  }

  console.log('Resetting local-service state...');
  console.log(`APP_DATA_DIR=${appDataDir}`);
  if (databaseFromEnv) {
    console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);
  }

  for (const target of targets) {
    await removeIfExists(target);
  }

  console.log('Done. Next start will recreate a clean initial state.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
