import logo from "@/assets/images/logo-universal.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferencesStore } from "@/state/preferences";
import { Languages, Laptop, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type HomeLayoutProps = {
  children: ReactNode;
  toolbarSlot?: ReactNode;
};

export const HomeLayout = ({ children, toolbarSlot }: HomeLayoutProps) => {
  const { t } = useTranslation("common");
  const { themePreference, setThemePreference, language, setLanguage } = usePreferencesStore();

  const ThemeIcon = themePreference === "system" ? Laptop : themePreference === "dark" ? Moon : Sun;

  return (
    <div className="sketch-background relative flex min-h-screen flex-col text-foreground">
      <div className="relative z-10 w-full px-4 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-6xl flex flex-col gap-8">
          <header>
            <div className="flex flex-col gap-6">
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="CAN logo"
                  className="h-12 w-12 rounded-xl border border-border/50 bg-gradient-to-br from-primary/20 to-primary/5"
                />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  {t("home.title")}
                </h1>
                <div className="flex items-center gap-2 ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Languages className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setLanguage("en")}>
                        English {language === "en" && "✓"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLanguage("zh")}>
                        中文 {language === "zh" && "✓"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <ThemeIcon className="h-4 w-4" />
                        <span className="sr-only">Toggle theme</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setThemePreference("light")}>
                        <Sun className="mr-2 h-4 w-4" />
                        {t("theme.light", "Light")}
                        {themePreference === "light" && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setThemePreference("dark")}>
                        <Moon className="mr-2 h-4 w-4" />
                        {t("theme.dark", "Dark")}
                        {themePreference === "dark" && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setThemePreference("system")}>
                        <Laptop className="mr-2 h-4 w-4" />
                        {t("theme.system", "System")}
                        {themePreference === "system" && <span className="ml-auto">✓</span>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {toolbarSlot && <div>{toolbarSlot}</div>}
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
};
