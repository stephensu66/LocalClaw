import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, isAbsolute } from 'path';
import type { OpenClawSessionInfo } from '@openclaw/shared';

export type NormalizedSessions = {
  sessions: OpenClawSessionInfo[];
  activeSessionId?: string;
};

export function normalizeAgentName(agentName?: string | null): string {
  const trimmed = agentName?.trim();
  if (!trimmed) return 'main';
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : 'main';
}

export function getSessionsDir(agentName?: string | null): string {
  const name = normalizeAgentName(agentName);
  return join(homedir(), '.openclaw', 'agents', name, 'sessions');
}

const isSessionInfo = (value: unknown): value is OpenClawSessionInfo => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as OpenClawSessionInfo;
  return typeof candidate.sessionId === 'string' || typeof candidate.sessionFile === 'string';
};

const toTimestamp = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export function readSessionsFile(agentName?: string | null): NormalizedSessions {
  const sessionsDir = getSessionsDir(agentName);
  const sessionsJsonPath = join(sessionsDir, 'sessions.json');

  if (!existsSync(sessionsJsonPath)) {
    return { sessions: [] };
  }

  try {
    const content = readFileSync(sessionsJsonPath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return { sessions: data.filter(isSessionInfo) };
    }

    if (data && typeof data === 'object') {
      const activeSessionId = typeof data.activeSessionId === 'string' ? data.activeSessionId : undefined;

      if (Array.isArray((data as any).sessions)) {
        const sessions = (data as any).sessions.filter(isSessionInfo);
        return { sessions, activeSessionId };
      }

      const values = Object.values(data).filter(isSessionInfo);
      if (values.length > 0) {
        return { sessions: values, activeSessionId };
      }
    }
  } catch (error) {
    console.error('Failed to read sessions.json:', error);
  }

  return { sessions: [] };
}

export function pickActiveSessionId(sessions: OpenClawSessionInfo[], fallback?: string): string | undefined {
  if (fallback && sessions.some((s) => s.sessionId === fallback)) {
    return fallback;
  }

  let best: OpenClawSessionInfo | undefined;
  let bestScore = 0;

  for (const session of sessions) {
    const score = Math.max(
      toTimestamp((session as any).updatedAt),
      toTimestamp((session as any).createdAt),
    );
    if (!best || score > bestScore) {
      best = session;
      bestScore = score;
    }
  }

  return best?.sessionId ?? sessions[0]?.sessionId;
}

export function resolveSessionFile(
  sessionId: string,
  sessions?: OpenClawSessionInfo[],
  agentName?: string | null
): string {
  if (sessionId.startsWith('/') || sessionId.includes('\\')) {
    return sessionId;
  }

  const list = sessions ?? readSessionsFile(agentName).sessions;
  const session = list.find((s) => s.sessionId === sessionId);
  const sessionFile = session?.sessionFile;

  if (sessionFile) {
    return isAbsolute(sessionFile) ? sessionFile : join(getSessionsDir(agentName), sessionFile);
  }

  return join(getSessionsDir(agentName), `${sessionId}.jsonl`);
}
