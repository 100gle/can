import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
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
import { useTranslation } from "react-i18next";

export function AdvancedSettingsCard() {
  const { t } = useTranslation();
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
      <CardContent className="flex flex-col md:flex-row gap-4 p-4">
        {/* Left: Title and Description */}
        <div className="md:w-48 shrink-0 space-y-1">
          <CardTitle>{t("settings.advanced.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.advanced.desc")}</CardDescription>
        </div>
        {/* Right: Settings Content */}
        <div className="flex-1 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="driver-select">{t("settings.advanced.driver")}</Label>
              <Select
                value={advancedOptions.databaseDriver}
                onValueChange={(val) =>
                  updateAdvancedOptions({
                    databaseDriver: val as DatabaseDriver,
                  })
                }
              >
                <SelectTrigger id="driver-select">
                  <SelectValue placeholder={t("settings.advanced.selectDriver")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sqlite">{t("settings.advanced.driverSqlite")}</SelectItem>
                  <SelectItem value="memory">{t("settings.advanced.driverMemory")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                {t("settings.advanced.driverWarn")}
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="log-select">{t("settings.advanced.logLevel")}</Label>
              <Select
                value={advancedOptions.logLevel}
                onValueChange={(val) => updateAdvancedOptions({ logLevel: val as LogLevel })}
              >
                <SelectTrigger id="log-select">
                  <SelectValue placeholder={t("settings.advanced.selectLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                {t("settings.advanced.logWarn")}
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
              {t("settings.advanced.reset")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
