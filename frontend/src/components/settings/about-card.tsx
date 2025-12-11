import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountsStore } from "@/state/accounts";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function AboutCard() {
  const accounts = useAccountsStore((state) => state.accounts);

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  return (
    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">当前版本</span>
          <span className="font-medium">{APP_VERSION}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">已连接账户</span>
          <span className="font-medium">{accounts.length}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground">遇到问题？</span>
          <Button variant="link" className="h-auto p-0" onClick={handleOpenIssues}>
            提交反馈
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
