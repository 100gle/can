import { ArrowLeft, Settings2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useBackNavigation";

type DashboardLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export const DashboardLayout = ({ sidebar, children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const handleBack = useBackNavigation(() => {
    navigate({ to: "/" });
  });

  const handleOpenSettings = () => {
    navigate({ to: "/settings" });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[260px] border-r border-border/40 bg-card/30 lg:flex">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:inline-flex">
              回到上一页或账户中心
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 lg:hidden"
            onClick={handleOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
            系统设置
          </Button>
        </div>
        <div className="lg:hidden border-b border-border/40 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          请在桌面端展开侧边栏以获得完整体验
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
