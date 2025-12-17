import { usePreferencesStore } from "@/state/preferences";
import { useEffect, useState } from "react";

type ThemeSelection = "light" | "dark";

export const useResolvedTheme = (): ThemeSelection => {
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const [systemTheme, setSystemTheme] = useState<ThemeSelection>("light");

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return themePreference === "system" ? systemTheme : themePreference;
};

export const ThemeProvider = () => {
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  return null;
};
