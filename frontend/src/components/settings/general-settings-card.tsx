import { useResolvedTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_ADVANCED_OPTIONS,
  usePreferencesStore,
  type AdvancedOptions,
  type DatabaseDriver,
  type LogLevel,
  type ThemePreference,
} from "@/state/preferences";
import { ThemeOptionButton } from "./theme-option-button";

export function GeneralSettingsCard() {
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const resolvedTheme = useResolvedTheme();
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setAdvancedOptions = usePreferencesStore((state) => state.setAdvancedOptions);
  const resetAdvancedOptions = usePreferencesStore((state) => state.resetAdvancedOptions);

  const handleThemeSelection = (value: ThemePreference) => {
    setThemePreference(value);
  };

  const updateAdvancedOptions = (patch: Partial<AdvancedOptions>) => {
    setAdvancedOptions(patch);
  };

  const handleResetAdvanced = () => {
    resetAdvancedOptions();
  };

  const isDefaultAdvanced =
    advancedOptions.databaseDriver === DEFAULT_ADVANCED_OPTIONS.databaseDriver &&
    advancedOptions.logLevel === DEFAULT_ADVANCED_OPTIONS.logLevel;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">基础设置</CardTitle>
          <CardDescription className="text-sm">外观主题与高级选项</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Appearance Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">外观</h3>
            <p className="text-xs text-muted-foreground">
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
            </p>
          </div>
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
        </div>

        <Separator />

        {/* Advanced Settings Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">高级选项</h3>
            <p className="text-xs text-muted-foreground">
              调整底层行为和日志级别，这些设置仅对当前设备生效
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="driver-select">数据库驱动</Label>
              <Select
                value={advancedOptions.databaseDriver}
                onValueChange={(val) =>
                  updateAdvancedOptions({
                    databaseDriver: val as DatabaseDriver,
                  })
                }
              >
                <SelectTrigger id="driver-select">
                  <SelectValue placeholder="选择驱动" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sqlite">SQLite (持久化)</SelectItem>
                  <SelectItem value="memory">Memory (临时会话)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                Memory 模式下数据将在重启后丢失。
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="log-select">日志级别</Label>
              <Select
                value={advancedOptions.logLevel}
                onValueChange={(val) => updateAdvancedOptions({ logLevel: val as LogLevel })}
              >
                <SelectTrigger id="log-select">
                  <SelectValue placeholder="选择级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                通常无需更改，Debug 模式会产生大量日志。
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={handleResetAdvanced}
              disabled={isDefaultAdvanced}
            >
              恢复默认设置
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
