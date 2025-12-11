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
import {
  DEFAULT_ADVANCED_OPTIONS,
  usePreferencesStore,
  type AdvancedOptions,
  type DatabaseDriver,
  type LogLevel,
} from "@/state/preferences";

export function AdvancedSettingsCard() {
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setAdvancedOptions = usePreferencesStore((state) => state.setAdvancedOptions);
  const resetAdvancedOptions = usePreferencesStore((state) => state.resetAdvancedOptions);

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
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>高级设置</CardTitle>
          <CardDescription className="text-xs">
            调整底层行为和日志级别，这些设置仅对当前设备生效
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
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
            <p className="text-[0.8rem] text-muted-foreground">Memory 模式下数据将在重启后丢失。</p>
          </div>

          <div className="space-y-2">
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
      </CardContent>
    </Card>
  );
}
