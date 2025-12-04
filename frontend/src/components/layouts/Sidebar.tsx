import { HelpCircle, Moon, Plus, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/images/logo-universal.png";
import { Button } from "@/components/ui/button";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";

type SidebarProps = {
  onCreateAccount?: () => void;
  onOpenSettings?: () => void;
};

export const Sidebar = ({ onCreateAccount, onOpenSettings }: SidebarProps) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark");
    setIsDark((prev) => !prev);
  };

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="logo"
          className="h-10 w-10 rounded-xl border border-border/40 bg-background/70 p-1.5"
        />
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">CAN</p>
          <p className="text-sm font-semibold">Object Studio</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <p className="px-2 text-xs uppercase tracking-widest text-muted-foreground">我的账户</p>
        <div className="mt-3 space-y-2">
          <AccountSwitcher />
        </div>
      </div>
      <div className="space-y-2">
        <Button size="sm" className="w-full gap-2" onClick={onCreateAccount}>
          <Plus className="h-4 w-4" />
          新建账户
        </Button>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
          系统设置
        </Button>
        <Button variant="ghost" size="sm" className="w-full gap-2" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "切换为浅色" : "切换为深色"}
        </Button>
        <Button variant="ghost" size="sm" className="w-full gap-2">
          <HelpCircle className="h-4 w-4" />
          帮助与支持
        </Button>
      </div>
    </div>
  );
};
