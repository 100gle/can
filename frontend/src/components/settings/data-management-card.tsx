import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess } from "@/lib/toast";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { useTranslation } from "react-i18next";

export function DataManagementCard() {
  const { t } = useTranslation();
  const accounts = useAccountsStore((state) => state.accounts);

  const handleExport = () => {
    if (!accounts.length) {
      showError(t("settings.data.exportEmpty"));
      return;
    }
    void accountsStore
      .exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const message = t("settings.data.exportSuccess", {
          count: summary.count,
          path: summary.filePath || "",
        });
        showSuccess(message);
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleImport = () => {
    void accountsStore
      .importAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        let message = t("settings.data.importSuccess", {
          imported: summary.imported,
          total: summary.total,
        });
        if (summary.skipped > 0 || summary.failed > 0) {
          message +=
            "\n" +
            t("settings.data.importSuccessDetails", {
              skipped: summary.skipped,
              failed: summary.failed,
            });
        }
        if (summary.issues?.length) {
          message += "\nDetails:";
          summary.issues.forEach((issue) => (message += `\n- ${issue}`));
        }
        showSuccess(message);
      })
      .catch(() => {
        /* handled */
      });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("settings.data.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.data.desc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
          {t("settings.data.import")}
        </Button>
        <Button onClick={handleExport} disabled={!accounts.length} className="w-full sm:w-auto">
          {t("settings.data.export")} ({accounts.length})
        </Button>
      </CardContent>
    </Card>
  );
}
