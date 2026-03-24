import { create } from 'zustand';
import type { LocalConfigView, LocalConfigInput } from '@openclaw/shared';
import { api } from '../api/client';

interface SettingsState {
  config: LocalConfigView | null;
  loading: boolean;
  error?: string;
  onboarded: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (input: Partial<LocalConfigInput>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: null,
  loading: false,
  error: undefined,
  onboarded: false,
  loadConfig: async () => {
    set({ loading: true, error: undefined });
    try {
      const config = await api.getConfig();
      set({ config, onboarded: config.onboarded ?? false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load config' });
    } finally {
      set({ loading: false });
    }
  },
  updateConfig: async (input) => {
    set({ loading: true, error: undefined });
    try {
      const config = await api.updateConfig(input);
      set({ config, onboarded: config.onboarded ?? false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to update config' });
    } finally {
      set({ loading: false });
    }
  },
}));
