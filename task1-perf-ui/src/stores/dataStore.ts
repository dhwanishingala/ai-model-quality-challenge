import { create } from 'zustand';
import type { ModelsMap, ViewMode } from '../lib/types';
import { deserializeModels } from '../lib/parser';

interface DataStore {
  models: ModelsMap;
  selectedProfile: number;
  viewMode: ViewMode;
  loading: boolean;
  setModels: (models: ModelsMap) => void;
  mergeModels: (models: ModelsMap) => void;
  setSelectedProfile: (profile: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  loadPrebuiltData: () => Promise<void>;
}

export const useDataStore = create<DataStore>((set, get) => ({
  models: new Map(),
  selectedProfile: 1,
  viewMode: 'customer',
  loading: true,

  setModels: (models) => set({ models }),

  mergeModels: (incoming) => {
    const current = get().models;
    const merged = new Map(current);
    for (const [name, data] of incoming) {
      const existing = merged.get(name);
      if (existing) {
        const profiles = new Map(existing.profiles);
        for (const [pNum, pData] of data.profiles) {
          profiles.set(pNum, pData);
        }
        merged.set(name, { modelName: name, profiles });
      } else {
        merged.set(name, data);
      }
    }
    set({ models: merged });
  },

  setSelectedProfile: (profile) => set({ selectedProfile: profile }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setLoading: (loading) => set({ loading }),

  loadPrebuiltData: async () => {
    set({ loading: true });
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}data/models.json`);
      if (!resp.ok) throw new Error('Failed to load prebuilt data');
      const raw = await resp.json();
      const models = deserializeModels(raw);
      set({ models, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
