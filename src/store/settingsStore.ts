import { create } from 'zustand';
import { settingsRepository } from '../repositories/settingsRepository';
import type { SystemSettings } from '../types/domain';

interface SettingsState {
  settings: SystemSettings;
  loading: boolean;
  fetchSettings: () => Promise<SystemSettings>;
  updateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { usePackages: false, allowNegativeStock: true, packagingSettings: {} },
  loading: true,
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await settingsRepository.getSettings();
      set({ settings, loading: false });
      return settings;
    } catch (e) {
      const fallback = { usePackages: false, allowNegativeStock: true, packagingSettings: {} };
      set({ loading: false, settings: fallback });
      return fallback;
    }
  },
  updateSettings: async (updated) => {
    set({ loading: true });
    try {
      await settingsRepository.updateSettings(updated);
      set((state) => ({
        settings: { ...state.settings, ...updated },
        loading: false
      }));
    } catch (e) {
      console.error("Error updating settings store:", e);
      set({ loading: false });
      throw e;
    }
  }
}));
