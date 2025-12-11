import { Button } from "@/components/ui/button";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type ConnectionTestButtonProps = {
  accountId?: string;
  disabled?: boolean;
};

export const ConnectionTestButton = ({ accountId, disabled }: ConnectionTestButtonProps) => {
  const { t } = useTranslation("common");
  const connectionTests = useAccountsStore((state) => state.connectionTests);
  const [testing, setTesting] = useState(false);
  const probe = accountId ? connectionTests[accountId] : undefined;

  const handleTestConnection = async () => {
    if (!accountId) return;
    setTesting(true);
    try {
      await accountsStore.testConnection(accountId);
    } catch (error) {
      const description = error instanceof Error ? error.message : t("account.switcher.testFailed");
      toast.error(t("account.switcher.testFailed"), { description });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!accountId || disabled || testing}
        onClick={handleTestConnection}
      >
        {testing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        {testing ? t("account.status.running") : t("account.form.test.button.idle")}
      </Button>
      <ProbeStatus status={probe?.status ?? "idle"} message={probe?.message} />
    </div>
  );
};

const ProbeStatus = ({ status, message }: { status: string; message?: string }) => {
  const { t } = useTranslation("common");
  if (status === "ok") {
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        {t("account.status.ok")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="h-4 w-4" />
        {message || t("account.status.error")}
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("account.status.running")}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t("account.status.pending")}</span>;
};
