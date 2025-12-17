import { useAppStatusStore } from "@/state/appStatus";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Displays a banner when the application is offline
 * Uses a simple state management approach to avoid infinite loops
 */
export const OfflineBanner = () => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = useAppStatusStore.subscribe((state) => {
      setShow(!state.isOnline);
      setReason(state.reason);
    });

    // Set initial state
    const initialState = useAppStatusStore.getState();
    setShow(!initialState.isOnline);
    setReason(initialState.reason);

    return unsubscribe;
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-900">
      <WifiOff className="h-4 w-4" />
      <span className="font-medium">{t("ui.offline.label")}</span>
      <span className="text-orange-700">·</span>
      <span className="text-orange-700">{t("ui.offline.description")}</span>
      {reason && (
        <>
          <span className="text-orange-700">·</span>
          <span className="text-xs text-orange-600">{reason}</span>
        </>
      )}
    </div>
  );
};
