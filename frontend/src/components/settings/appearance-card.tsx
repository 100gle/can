import { useResolvedTheme } from "@/components/providers/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePreferencesStore, type ThemePreference } from "@/state/preferences";
import { ThemeOptionButton } from "./theme-option-button";

export function AppearanceCard() {
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const resolvedTheme = useResolvedTheme();

  const handleThemeSelection = (value: ThemePreference) => {
    setThemePreference(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>外观</CardTitle>
          <CardDescription className="text-xs">
            自定义界面显示模式
            <span className="ml-1.5 inline-block">
              (当前:{" "}
              {themePreference === "system"
                ? `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}`
                : resolvedTheme === "dark"
                  ? "深色"
                  : "浅色"}
              )
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <ThemeOptionButton
            value="light"
            isSelected={themePreference === "light"}
            label="浅色"
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
            value="dark"
            isSelected={themePreference === "dark"}
            label="深色"
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
            value="system"
            isSelected={themePreference === "system"}
            label="系统"
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
                Auto
              </div>
            </div>
          </ThemeOptionButton>
        </div>
      </CardContent>
    </Card>
  );
}
