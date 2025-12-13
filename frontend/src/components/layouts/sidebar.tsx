import logo from "@/assets/images/logo-universal.png";
import { AccountSwitcher } from "@/components/accounts/account-switcher";
import { Button } from "@/components/ui/button";
import { useTransferStats } from "@/state/transfers";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Settings, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const TRANSFERS_SEEN_KEY = "transfers-indicator-seen";
const TRANSFERS_LAST_COUNT_KEY = "transfers-last-seen-count";

type SidebarProps = {
  onCreateAccount?: () => void;
  accountId?: string;
};

export const Sidebar = ({ onCreateAccount, accountId: _accountId }: SidebarProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { total } = useTransferStats();
  const [hasSeen, setHasSeen] = useState(() => {
    return localStorage.getItem(TRANSFERS_SEEN_KEY) === "true";
  });

  // Track previous total count to detect new tasks
  const getInitialCount = () => {
    const stored = localStorage.getItem(TRANSFERS_LAST_COUNT_KEY);
    return stored ? parseInt(stored, 10) : 0;
  };
  const prevTotalRef = useRef<number>(getInitialCount());

  // Reset seen state only when new tasks are added (total count increases)
  useEffect(() => {
    const prevTotal = prevTotalRef.current;
    if (total > prevTotal && total > 0) {
      // New task(s) added
      setHasSeen(false);
      localStorage.removeItem(TRANSFERS_SEEN_KEY);
    }
    prevTotalRef.current = total;
    localStorage.setItem(TRANSFERS_LAST_COUNT_KEY, String(total));
  }, [total]);

  const handleTransfersClick = useCallback(() => {
    // Mark as seen
    localStorage.setItem(TRANSFERS_SEEN_KEY, "true");
    setHasSeen(true);
    navigate({ to: "/transfers" });
  }, [navigate]);

  // Show red dot if: there are tasks AND user hasn't seen them yet
  const showRedDot = !hasSeen && total > 0;

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <Button
        variant="ghost"
        onClick={() => navigate({ to: "/" })}
        className="flex items-center gap-3 rounded-xl p-2 h-auto justify-start"
        aria-label={t("nav.home")}
      >
        <img
          src={logo}
          alt="logo"
          className="h-10 w-10 rounded-xl border border-border/40 bg-background/70 p-1.5"
        />
        <div className="text-left">
          <p className="text-md font-bold tracking-wider text-primary font-mono">Can Studio</p>
        </div>
      </Button>
      <div className="flex-1 overflow-y-auto pr-1">
        <p className="px-2 text-xs uppercase tracking-widest text-muted-foreground">
          {t("nav.myAccounts", "My Accounts")}
        </p>
        <div className="mt-3 space-y-2">
          <AccountSwitcher />
        </div>
      </div>
      <div className="space-y-2">
        <Button size="sm" className="w-full gap-2" onClick={onCreateAccount}>
          <Plus className="h-4 w-4" />
          {t("nav.newAccount", "New Account")}
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleTransfersClick}
          >
            <Share2 className="h-4 w-4" />
            {t("nav.transfers", "Transfers")}
          </Button>
          {showRedDot && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate({ to: "/settings" })}
        >
          <Settings className="h-4 w-4" />
          {t("settings")}
        </Button>
      </div>
    </div>
  );
};
