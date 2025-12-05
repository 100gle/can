import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { accountsStore, useAccountsStore } from "@/state/accounts";

type ConnectionTestButtonProps = {
  accountId?: string;
  disabled?: boolean;
};

export const ConnectionTestButton = ({ accountId, disabled }: ConnectionTestButtonProps) => {
  const connectionTests = useAccountsStore((state) => state.connectionTests);
  const [testing, setTesting] = useState(false);
  const probe = accountId ? connectionTests[accountId] : undefined;

  const handleTestConnection = async () => {
    if (!accountId) return;
    setTesting(true);
    try {
      await accountsStore.testConnection(accountId);
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
        {testing ? "测试中..." : "测试连接"}
      </Button>
      <ProbeStatus status={probe?.status ?? "idle"} message={probe?.message} />
    </div>
  );
};

const ProbeStatus = ({ status, message }: { status: string; message?: string }) => {
  if (status === "ok") {
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        连接正常
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="h-4 w-4" />
        {message || "连接异常"}
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        测试中...
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">等待测试</span>;
};
