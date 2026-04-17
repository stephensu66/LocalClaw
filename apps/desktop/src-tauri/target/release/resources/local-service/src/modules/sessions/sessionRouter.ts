import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import type { Env } from '../../config/env';
import type { OpenClawSessionEvent, OpenClawSessionResponse, OpenClawSessionRecords } from '@openclaw/shared';
import { normalizeAgentName, pickActiveSessionId, readSessionsFile, resolveSessionFile } from './sessionStore';

export function createSessionRouter(env: Env) {
  const router = Router();
  void env;

  const getAgentNameFromQuery = (query: Record<string, unknown>) => {
    const raw = typeof query.agentName === 'string' ? query.agentName : undefined;
    return normalizeAgentName(raw);
  };

  const readSessionEvents = (sessionId: string, agentName: string): OpenClawSessionEvent[] => {
    try {
      const decodedId = decodeURIComponent(sessionId);
      const { sessions } = readSessionsFile(agentName);
      const eventFile = resolveSessionFile(decodedId, sessions, agentName);
      const eventFileName = basename(eventFile);

      if (!existsSync(eventFile)) {
        console.warn(`Event file not found at ${eventFile}`);
        return [];
      }

      const content = readFileSync(eventFile, 'utf-8');
      if (!content.trim()) {
        console.warn(`Event file is empty: ${eventFile}`);
        return [];
      }

      const lines = content.split('\n').filter(line => line.trim());
      console.log(`Loaded ${lines.length} events from ${eventFileName}`);

      return lines.map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error(`Failed to parse line ${index}:`, e);
          return { type: 'error', id: `error-${index}`, text: `Failed to parse event: ${line.substring(0, 100)}` };
        }
      });
    } catch (error) {
      console.error(`Failed to read session events for ${sessionId}:`, error);
      return [];
    }
  };

  router.get('/', (_req, res) => {
    try {
      const agentName = getAgentNameFromQuery(_req.query as Record<string, unknown>);
      const { sessions, activeSessionId: rawActive } = readSessionsFile(agentName);
      const activeSessionId = pickActiveSessionId(sessions, rawActive);

      console.log(`Listed ${sessions.length} sessions for ${agentName}, active: ${activeSessionId}`);

      const response: OpenClawSessionResponse = {
        sessions,
        activeSessionId: activeSessionId ?? undefined,
      };

      res.json(response);
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  router.get('/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const agentName = getAgentNameFromQuery(req.query as Record<string, unknown>);
      console.log(`Getting session: ${sessionId} for ${agentName}`);

      const records = readSessionEvents(sessionId, agentName);

      const response: OpenClawSessionRecords = {
        records,
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  return router;
}
