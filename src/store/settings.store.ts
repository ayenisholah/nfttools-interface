import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';

interface SettingsState {
  apiKey: string;
  fundingWif: string;
  tokenReceiveAddress: string;
  rateLimit: number;
  bidExpiration: number;
  defaultOutbidMargin: number;
  defaultLoopTime: number;
  defaultCounterLoopTime: number;
  updateSettings: (settings: Partial<SettingsState>) => void;
}

const persistOptions: PersistOptions<SettingsState> = {
  name: 'settings',
};

export const useSettingsState = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: "",
      fundingWif: "",
      tokenReceiveAddress: "",
      rateLimit: 0,
      bidExpiration: 10,
      defaultOutbidMargin: 0.00000001,
      defaultLoopTime: 60,
      defaultCounterLoopTime: 60,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    persistOptions
  )
);
