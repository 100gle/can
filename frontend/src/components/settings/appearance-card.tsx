import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { ThemeOptionButton } from "./theme-option-button";

export function AppearanceCard() {
  const { t, i18n } = useTranslation();
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);

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
            <Select
              value={i18n.language.slice(0, 2)}
              onValueChange={(val) => i18n.changeLanguage(val)}
            >
              <SelectTrigger id="language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">{t("settings.language.zh")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>{t("settings.theme")}</Label>
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
                {/* Split Background with Light/Dark Skeletons */}
                <div className="absolute inset-0 flex">
                  {/* Light Side */}
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
                  {/* Dark Side */}
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
        </div>
      </CardContent>
    </Card>
  );
}
