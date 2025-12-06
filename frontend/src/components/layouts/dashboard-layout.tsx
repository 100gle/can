import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, Settings2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DashboardBreadcrumb, useDashboardBreadcrumbs } from "./dashboard-breadcrumb";

type DashboardLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
  accountName?: string;
  accountMeta?: string;
  showSettingsShortcut?: boolean;
};

export const DashboardLayout = ({
  sidebar,
  children,
  accountName,
  accountMeta,
  showSettingsShortcut = true,
}: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { items: breadcrumbs, isSubPage } = useDashboardBreadcrumbs();

  const handleOpenSettings = () => {
    navigate({ to: "/settings" });
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "hidden sticky top-0 h-screen border-r border-border/40 bg-card/30 transition-[width,opacity] duration-300 ease-in-out lg:flex",
          isSidebarCollapsed
            ? "w-0 overflow-hidden border-transparent opacity-0"
            : "w-[260px] lg:w-[260px]",
        )}
        aria-hidden={isSidebarCollapsed}
      >
        <div
          className={cn(
            "h-full w-[260px] transition-opacity duration-300",
            isSidebarCollapsed && "pointer-events-none opacity-0",
          )}
        >
          {sidebar}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={handleToggleSidebar}
              aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>

            <DashboardBreadcrumb />
            {accountName ? (
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-semibold">{accountName}</p>
                {accountMeta ? (
                  <p className="truncate text-xs text-muted-foreground">{accountMeta}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {showSettingsShortcut ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 lg:hidden"
              onClick={handleOpenSettings}
            >
              <Settings2 className="h-4 w-4" />
              系统设置
            </Button>
          ) : null}
        </div>
        <div className="lg:hidden border-b border-border/40 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          请在桌面端展开侧边栏以获得完整体验
        </div>
        <div className="flex-1 overflow-y-auto">
          {isSubPage && breadcrumbs.length > 1 && (
            <div className="px-4 pt-4 md:px-8">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const parent = breadcrumbs[breadcrumbs.length - 2];
                  if (parent) {
                    navigate({ to: parent.to });
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
