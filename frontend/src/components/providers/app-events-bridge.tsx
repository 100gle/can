import { isDesktopMode } from "@/lib/bridge";
import { EventsOn } from "@wailsjs/runtime/runtime";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const WINDOW_VISIBILITY_EVENT = "app:window-visibility";

export function AppEventsBridge() {
  const { t } = useTranslation();
  const hasShownHint = useRef(false);

  useEffect(() => {
    if (!isDesktopMode()) {
      return;
    }
    const off = EventsOn(WINDOW_VISIBILITY_EVENT, (visible?: boolean) => {
      if (visible === false && !hasShownHint.current) {
        toast.info(t("app.tray.hint"));
        hasShownHint.current = true;
      }
    });
    return () => {
      off();
    };
  }, [t]);

  return null;
}
