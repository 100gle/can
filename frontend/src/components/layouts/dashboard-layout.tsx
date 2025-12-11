import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, Settings2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardBreadcrumb } from "./dashboard-breadcrumb";

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
  accountName: _accountName,
  accountMeta: _accountMeta,
  showSettingsShortcut = true,
}: DashboardLayoutProps) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
            : "w-[220px] lg:w-[220px]",
        )}
        aria-hidden={isSidebarCollapsed}
      >
        <div
          className={cn(
            "h-full w-[220px] transition-opacity duration-300",
            isSidebarCollapsed && "pointer-events-none opacity-0",
          )}
        >
          {sidebar}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={handleToggleSidebar}
              aria-label={
                isSidebarCollapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")
              }
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>

            <DashboardBreadcrumb />
          </div>
          {showSettingsShortcut && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 lg:hidden"
              onClick={handleOpenSettings}
            >
              <Settings2 className="h-4 w-4" />
              {t("settings")}
            </Button>
          )}
        </div>
        <div className="lg:hidden border-b border-border/40 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          {t("layout.mobileWarning")}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
