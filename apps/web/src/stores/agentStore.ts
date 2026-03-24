import { create } from 'zustand';

const SELECTED_AGENT_KEY = 'openclaw_selected_agent';
const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function normalizeAgentName(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed || !AGENT_NAME_PATTERN.test(trimmed)) return 'main';
  return trimmed;
}

function loadSelectedAgentName(): string {
  try {
    return normalizeAgentName(localStorage.getItem(SELECTED_AGENT_KEY));
  } catch {
    return 'main';
  }
}

interface AgentState {
  selectedAgentName: string;
  setSelectedAgentName: (name: string) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  selectedAgentName: loadSelectedAgentName(),
  setSelectedAgentName: (name) => {
    const normalized = normalizeAgentName(name);
    try {
      localStorage.setItem(SELECTED_AGENT_KEY, normalized);
    } catch {
      // Ignore storage errors and keep state in memory.
    }
    set({ selectedAgentName: normalized });
  },
}));

