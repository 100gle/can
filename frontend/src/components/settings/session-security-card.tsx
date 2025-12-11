import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/state/session";
import { useTranslation } from "react-i18next";

export function SessionSecurityCard() {
  const { t } = useTranslation();
  const idleTimeoutMinutes = useSessionStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = useSessionStore((state) => state.lockStrategy);
  const setIdleTimeout = useSessionStore((state) => state.setIdleTimeout);
  const setLockStrategy = useSessionStore((state) => state.setLockStrategy);

  const handleIdleTimeoutChange = (value: string) => {
    setIdleTimeout(Number(value));
  };

  const handleLockStrategyChange = (value: "lock" | "logout") => {
    setLockStrategy(value);
  };

  // Easier to just map known values or use formatting.
  // Given only 15 and 60 are options, plus 0.
  const displayIdleLabel =
    idleTimeoutMinutes === 0
      ? t("settings.session.never")
      : idleTimeoutMinutes === 60
        ? t("settings.session.time.1hour")
        : t("settings.session.time.15min");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("settings.session.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.session.desc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idle-timeout">{t("settings.session.idleTimeout")}</Label>
          <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
            <SelectTrigger id="idle-timeout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">{t("settings.session.time.15min")}</SelectItem>
              <SelectItem value="60">{t("settings.session.time.1hour")}</SelectItem>
              <SelectItem value="0">{t("settings.session.never")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("settings.session.currentPolicy", { policy: displayIdleLabel })}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lock-strategy">{t("settings.session.action")}</Label>
          <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
            <SelectTrigger id="lock-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lock">{t("settings.session.lock")}</SelectItem>
              <SelectItem value="logout">{t("settings.session.logout")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings.session.recommendation")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
