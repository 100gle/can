import { offlineManager } from "@/lib/offline";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

export type ThemeSelection = "light" | "dark";

export type DatabaseDriver = "sqlite" | "memory";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type CacheSize = 10 | 50 | 100 | 500; // MB

export type AdvancedOptions = {
  databaseDriver: DatabaseDriver;
  logLevel: LogLevel;
};

export type ViewMode = "grid" | "list" | "tree";

export const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  databaseDriver: "sqlite",
  logLevel: "info",
};

export const THEME_PREFERENCE_KEY = "can:theme-preference";
export const ADVANCED_SETTINGS_KEY = "can:advanced-settings";
const PREFERENCES_STORAGE_KEY = "can:preferences";

type PreferencesState = {
  themePreference: ThemePreference;
  systemTheme: ThemeSelection;
  advancedOptions: AdvancedOptions;
  viewMode: ViewMode;
  offlineCacheEnabled: boolean;
  offlineCacheSize: CacheSize;
  backupEncryptionEnabled: boolean;
  setThemePreference: (value: ThemePreference) => void;
  setSystemTheme: (value: ThemeSelection) => void;
  setAdvancedOptions: (patch: Partial<AdvancedOptions>) => void;
  resetAdvancedOptions: () => void;
  resetAllSettings: () => void;
  setViewMode: (mode: ViewMode) => void;
  setOfflineCacheEnabled: (enabled: boolean) => void;
  setOfflineCacheSize: (size: CacheSize) => void;
  setBackupEncryptionEnabled: (enabled: boolean) => void;
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const ensureStringValue = (value: string | null | Promise<string | null>): string | null => {
  if (typeof value === "string" || value === null) return value;
  return null;
};

const getBrowserStorage = (): StateStorage => {
  if (typeof window === "undefined") return noopStorage;
  const storage = window.localStorage as Partial<StateStorage>;
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return noopStorage;
  }
  return storage as StateStorage;
};

const jsonStorage =
  createJSONStorage<Pick<PreferencesState, "themePreference" | "advancedOptions">>(
    getBrowserStorage,
  );

const cloneDefaultAdvancedOptions = (): AdvancedOptions => ({ ...DEFAULT_ADVANCED_OPTIONS });

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: "system",
      systemTheme: "light",
      advancedOptions: cloneDefaultAdvancedOptions(),
      viewMode: "grid",
      offlineCacheEnabled: true,
      offlineCacheSize: 100,
      backupEncryptionEnabled: false,
      setThemePreference: (value) => set({ themePreference: value }),
      setSystemTheme: (value) => set({ systemTheme: value }),
      setAdvancedOptions: (patch) =>
        set((state) => ({
          advancedOptions: { ...state.advancedOptions, ...patch },
        })),
      resetAdvancedOptions: () => set({ advancedOptions: cloneDefaultAdvancedOptions() }),
      resetAllSettings: () =>
        set({
          themePreference: "system",
          advancedOptions: cloneDefaultAdvancedOptions(),
          viewMode: "grid",
          offlineCacheEnabled: true,
          offlineCacheSize: 100,
          backupEncryptionEnabled: false,
        }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setOfflineCacheEnabled: (enabled) => set({ offlineCacheEnabled: enabled }),
      setOfflineCacheSize: (size) => set({ offlineCacheSize: size }),
      setBackupEncryptionEnabled: (enabled) => set({ backupEncryptionEnabled: enabled }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      storage: jsonStorage,
      partialize: (state) => ({
        themePreference: state.themePreference,
        advancedOptions: state.advancedOptions,
        viewMode: state.viewMode,
        offlineCacheEnabled: state.offlineCacheEnabled,
        offlineCacheSize: state.offlineCacheSize,
        backupEncryptionEnabled: state.backupEncryptionEnabled,
      }),
    },
  ),
);

const parseThemePreference = (value: string | null): ThemePreference => {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
};

const readAdvancedOptions = (raw: string | null): AdvancedOptions => {
  if (!raw) return DEFAULT_ADVANCED_OPTIONS;
  try {
    const parsed = JSON.parse(raw) as Partial<AdvancedOptions>;
    return {
      ...DEFAULT_ADVANCED_OPTIONS,
      ...parsed,
    };
  } catch {
    return DEFAULT_ADVANCED_OPTIONS;
  }
};

const hydrateFromLegacyKeys = () => {
  if (typeof window === "undefined") return;
  const storage = getBrowserStorage();
  if (storage === noopStorage) return;
  if (storage.getItem(PREFERENCES_STORAGE_KEY)) {
    return;
  }
  const themePreference = parseThemePreference(
    ensureStringValue(storage.getItem(THEME_PREFERENCE_KEY)),
  );
  const advancedOptions = readAdvancedOptions(
    ensureStringValue(storage.getItem(ADVANCED_SETTINGS_KEY)),
  );
  const hasLegacyData =
    themePreference !== "system" ||
    advancedOptions.databaseDriver !== DEFAULT_ADVANCED_OPTIONS.databaseDriver ||
    advancedOptions.logLevel !== DEFAULT_ADVANCED_OPTIONS.logLevel;
  if (!hasLegacyData) return;
  usePreferencesStore.setState((state) => ({
    ...state,
    themePreference,
    advancedOptions,
  }));
};

if (typeof window !== "undefined") {
  hydrateFromLegacyKeys();

  // Subscribe to offlineCacheSize changes
  let previousSize = usePreferencesStore.getState().offlineCacheSize;
  usePreferencesStore.subscribe((state) => {
    if (state.offlineCacheSize !== previousSize) {
      previousSize = state.offlineCacheSize;
      offlineManager.configure({ cacheSizeMB: state.offlineCacheSize });
    }
  });
}
