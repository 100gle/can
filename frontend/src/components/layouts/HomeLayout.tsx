import type { ReactNode } from "react";
import { DownloadCloud, Settings2, UploadCloud } from "lucide-react";
import logo from "@/assets/images/logo-universal.png";
import { Button } from "@/components/ui/button";

type HomeLayoutProps = {
  children: ReactNode;
  onImportAccounts?: () => void;
  onExportAccounts?: () => void;
  onOpenSettings?: () => void;
  toolbarSlot?: ReactNode;
};

export const HomeLayout = ({
  children,
  onImportAccounts,
  onExportAccounts,
  onOpenSettings,
  toolbarSlot,
}: HomeLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-primary/10 px-4 py-6 text-foreground sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-3xl border border-border/40 bg-card/70 px-6 py-5 shadow-xl shadow-primary/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={logo}
            alt="CAN logo"
            className="h-14 w-14 rounded-2xl border border-border/30 bg-background/80 p-2"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-muted-foreground">
              CAN Object Studio
            </p>
            <h1 className="text-2xl font-semibold">多账户连接中心</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarSlot}
          <Button variant="outline" size="sm" className="gap-2" onClick={onImportAccounts}>
            <UploadCloud className="h-4 w-4" />
            导入配置
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onExportAccounts}>
            <DownloadCloud className="h-4 w-4" />
            导出配置
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={onOpenSettings}>
            <Settings2 className="h-4 w-4" />
            系统设置
          </Button>
        </div>
      </header>
      <main className="mx-auto mt-6 w-full max-w-6xl">{children}</main>
    </div>
  );
};
