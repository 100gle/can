import { useEffect, useRef } from "react";
import { isDesktopMode } from "@/lib/bridge";
import { EventsOn } from "@wailsjs/runtime/runtime";
import { toast } from "sonner";

const WINDOW_VISIBILITY_EVENT = "app:window-visibility";

export function AppEventsBridge() {
  const hasShownHint = useRef(false);

  useEffect(() => {
    if (!isDesktopMode()) {
      return;
    }
    const off = EventsOn(WINDOW_VISIBILITY_EVENT, (visible?: boolean) => {
      if (visible === false && !hasShownHint.current) {
        toast.info("CAN 已隐藏到系统托盘，可通过托盘图标重新打开。");
        hasShownHint.current = true;
      }
    });
    return () => {
      off();
    };
  }, []);

  return null;
}
