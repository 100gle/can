import logo from "@/assets/images/logo-universal.png";
import { Button } from "@/components/ui/button";
import { DownloadCloud, Settings2, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";

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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-background/95 text-foreground">
      <div className="w-full px-4 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-6xl flex flex-col gap-8">
          <header>
            <div className="flex flex-col gap-6">
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="CAN logo"
                  className="h-12 w-12 rounded-xl border border-border/50 bg-gradient-to-br from-primary/20 to-primary/5 p-1.5"
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5em] text-muted-foreground/70">
                    CAN Object Studio
                  </p>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    多账户连接中心
                  </h1>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {toolbarSlot && <div>{toolbarSlot}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="default" size="sm" className="gap-2" onClick={onImportAccounts}>
                    <UploadCloud className="h-4 w-4" />
                    导入配置
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={onExportAccounts}>
                    <DownloadCloud className="h-4 w-4" />
                    导出配置
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={onOpenSettings}>
                    <Settings2 className="h-4 w-4" />
                    设置
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
};
