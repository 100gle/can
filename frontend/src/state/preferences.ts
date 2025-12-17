import i18n from "@/i18n/config";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type ViewMode = "grid" | "list" | "tree";
export type LockStrategy = "lock" | "logout";
export type LockReason = "idle" | "logout";

const PREFERENCES_STORAGE_KEY = "can:preferences";

type PreferencesState = {
  // Appearance
  themePreference: ThemePreference;
  language: string;

  // System/Logging
  logLevel: LogLevel;

  // View Settings
  viewMode: ViewMode;

  // Transfer Settings
  maxConcurrentTransfers: number;
  transferSpeedLimitBytes: number;

  // Session Security
  idleTimeoutMinutes: number;
  lockStrategy: LockStrategy;
  locked: boolean;
  lockReason: LockReason | null;

  // Actions
  setThemePreference: (value: ThemePreference) => void;
  setLanguage: (value: string) => void;
  setLogLevel: (value: LogLevel) => void;
  setViewMode: (mode: ViewMode) => void;
  setMaxConcurrentTransfers: (value: number) => void;
  setTransferSpeedLimit: (bytes: number) => void;
  setIdleTimeout: (minutes: number) => void;
  setLockStrategy: (strategy: LockStrategy) => void;
  lock: (reason: LockReason) => void;
  unlock: () => void;
  resetAllSettings: () => void;
};

const jsonStorage = createJSONStorage<
  Pick<
    PreferencesState,
    | "themePreference"
    | "language"
    | "logLevel"
    | "viewMode"
    | "maxConcurrentTransfers"
    | "transferSpeedLimitBytes"
    | "idleTimeoutMinutes"
    | "lockStrategy"
  >
>(() => localStorage);

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Defaults
      themePreference: "system",
      language: "en",
      logLevel: "info",
      viewMode: "grid",
      maxConcurrentTransfers: 2,
      transferSpeedLimitBytes: 0,
      idleTimeoutMinutes: 15,
      lockStrategy: "lock",
      locked: false,
      lockReason: null,

      // Actions
      setThemePreference: (value) => set({ themePreference: value }),
      setLanguage: (value) => {
        i18n.changeLanguage(value);
        set({ language: value });
      },
      setLogLevel: (value) => set({ logLevel: value }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setMaxConcurrentTransfers: (value) => set({ maxConcurrentTransfers: value }),
      setTransferSpeedLimit: (bytes) => set({ transferSpeedLimitBytes: bytes }),

      setIdleTimeout: (minutes) => set({ idleTimeoutMinutes: minutes }),
      setLockStrategy: (strategy) => set({ lockStrategy: strategy }),
      lock: (reason) => set({ locked: true, lockReason: reason }),
      unlock: () => set({ locked: false, lockReason: null }),

      resetAllSettings: () =>
        set({
          themePreference: "system",
          language: "en",
          logLevel: "info",
          viewMode: "grid",
          maxConcurrentTransfers: 2,
          transferSpeedLimitBytes: 0,
          idleTimeoutMinutes: 15,
          lockStrategy: "lock",
        }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      storage: jsonStorage,
      partialize: (state) => ({
        themePreference: state.themePreference,
        language: state.language,
        logLevel: state.logLevel,
        viewMode: state.viewMode,
        maxConcurrentTransfers: state.maxConcurrentTransfers,
        transferSpeedLimitBytes: state.transferSpeedLimitBytes,
        idleTimeoutMinutes: state.idleTimeoutMinutes,
        lockStrategy: state.lockStrategy,
      }),
    },
  ),
);
