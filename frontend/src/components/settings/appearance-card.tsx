import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferencesStore, type ThemePreference } from "@/state/preferences";
import { useTranslation } from "react-i18next";
import { ThemeOptionButton } from "./theme-option-button";

export function AppearanceCard() {
  const { t, i18n } = useTranslation();
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);

  const handleThemeSelection = (value: ThemePreference) => {
    setThemePreference(value);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("settings.appearance.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.appearance.desc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="language-select">{t("settings.language")}</Label>
            <Select value={i18n.language} onValueChange={(val) => i18n.changeLanguage(val)}>
              <SelectTrigger id="language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                <SelectItem value="zh">{t("settings.language.zh")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>{t("settings.theme")}</Label>
          <div className="grid grid-cols-3 gap-4">
            <ThemeOptionButton
              isSelected={themePreference === "light"}
              label={t("settings.theme.light")}
              onClick={() => handleThemeSelection("light")}
            >
              <div className="flex h-[100px] w-full flex-col justify-between rounded-lg bg-[#ecedef] p-2 transition-transform group-hover:scale-[1.02]">
                <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                  <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                  <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                </div>
              </div>
            </ThemeOptionButton>

            <ThemeOptionButton
              isSelected={themePreference === "dark"}
              label={t("settings.theme.dark")}
              onClick={() => handleThemeSelection("dark")}
            >
              <div className="flex h-[100px] w-full flex-col justify-between rounded-lg bg-slate-950 p-2 transition-transform group-hover:scale-[1.02]">
                <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                  <div className="h-2 w-[80px] rounded-lg bg-slate-500" />
                  <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-500" />
                  <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                </div>
              </div>
            </ThemeOptionButton>

            <ThemeOptionButton
              isSelected={themePreference === "system"}
              label={t("settings.theme.system")}
              onClick={() => handleThemeSelection("system")}
            >
              <div className="relative flex h-[100px] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#ecedef] via-slate-200 to-slate-900 transition-transform group-hover:scale-[1.02]">
                {/* Split Background effect */}
                <div className="absolute inset-0 flex">
                  <div className="w-1/2 bg-[#ecedef] p-2">
                    <div className="mt-4 h-2 w-12 rounded-full bg-white opacity-60" />
                  </div>
                  <div className="w-1/2 bg-slate-950 p-2">
                    <div className="ml-auto mt-4 h-2 w-12 rounded-full bg-slate-800 opacity-60" />
                  </div>
                </div>
                <div className="relative z-10 rounded-md bg-background/80 px-2 py-1 text-xs font-bold shadow-sm backdrop-blur-sm">
                  {/* TODO: auto icon */}
                </div>
              </div>
            </ThemeOptionButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
