import { useEffect } from "react";
import {
  ADVANCED_SETTINGS_KEY,
  THEME_PREFERENCE_KEY,
  usePreferencesStore,
  type ThemeSelection,
} from "@/state/preferences";

export const useResolvedTheme = (): ThemeSelection => {
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const systemTheme = usePreferencesStore((state) => state.systemTheme);
  return themePreference === "system" ? systemTheme : themePreference;
};

export const ThemeProvider = () => {
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setSystemTheme = usePreferencesStore((state) => state.setSystemTheme);
  const resolvedTheme = useResolvedTheme();

  const safeSetItem = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    const storage = window.localStorage as Partial<Storage>;
    if (typeof storage?.setItem !== "function") return;
    storage.setItem(key, value);
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setSystemTheme("light");
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyMatch = () => setSystemTheme(media.matches ? "dark" : "light");
    applyMatch();
    media.addEventListener("change", applyMatch);
    return () => media.removeEventListener("change", applyMatch);
  }, [setSystemTheme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    safeSetItem(THEME_PREFERENCE_KEY, themePreference);
  }, [themePreference]);

  useEffect(() => {
    safeSetItem(ADVANCED_SETTINGS_KEY, JSON.stringify(advancedOptions));
  }, [advancedOptions]);

  return null;
};
