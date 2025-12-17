import { RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferencesStore, type ThemePreference } from "@/state/preferences";
import { SunMoon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";
import { ThemeOptionButton } from "./theme-option-button";

export function AppearanceCard() {
  const { t } = useTranslation();
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const language = usePreferencesStore((state) => state.language);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);

  return (
    <SettingsSection
      title={t("settings.appearance.title")}
      description={t("settings.appearance.desc")}
    >
      <SettingsItem label={t("settings.language")}>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">{t("settings.language.zh")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>

      <SettingsItem label={t("settings.theme")} fullWidth showSeparator={false}>
        <RadioGroup
          value={themePreference}
          onValueChange={(value) => setThemePreference(value as ThemePreference)}
          className="grid grid-cols-3 gap-4"
        >
          <ThemeOptionButton
            value="light"
            isSelected={themePreference === "light"}
            label={t("settings.theme.light")}
            onSelect={() => setThemePreference("light")}
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
            value="dark"
            isSelected={themePreference === "dark"}
            label={t("settings.theme.dark")}
            onSelect={() => setThemePreference("dark")}
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
            value="system"
            isSelected={themePreference === "system"}
            label={t("settings.theme.system")}
            onSelect={() => setThemePreference("system")}
          >
            <div className="relative flex h-[100px] w-full items-center justify-center overflow-hidden rounded-lg transition-transform group-hover:scale-[1.02]">
              <div className="absolute inset-0 flex">
                <div className="flex w-1/2 flex-col justify-between bg-[#ecedef] p-2">
                  <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                </div>
                <div className="flex w-1/2 flex-col justify-between bg-slate-950 p-2">
                  <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-slate-500" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-slate-500" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                  </div>
                </div>
              </div>
              <div className="relative z-10 rounded-full bg-background p-2 shadow-sm backdrop-blur-sm">
                <SunMoon className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </ThemeOptionButton>
        </RadioGroup>
      </SettingsItem>
    </SettingsSection>
  );
}
