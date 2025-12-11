import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountsStore } from "@/state/accounts";
import { useTranslation } from "react-i18next";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function AboutCard() {
  const { t } = useTranslation();
  const accounts = useAccountsStore((state) => state.accounts);

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.about.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("settings.about.version")}</span>
          <span className="font-medium">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("settings.about.connectedAccounts")}</span>
          <span className="font-medium">{accounts.length}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground">{t("settings.about.issues")}</span>
          <Button variant="link" className="h-auto p-0" onClick={handleOpenIssues}>
            {t("settings.about.feedback")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
