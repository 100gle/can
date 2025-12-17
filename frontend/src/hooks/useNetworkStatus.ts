import { logger } from "@/lib/logger";
import { useAppStatusStore } from "@/state/appStatus";
import { PingEndpoint } from "@wailsjs/go/app/App";
import { useCallback, useEffect, useRef } from "react";

const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 5000; // 5 seconds
const DEFAULT_PING_TARGET = "https://www.google.com";

export type NetworkStatus = {
  isOnline: boolean;
  lastChecked: number | null;
  reason: string;
};

/**
 * Network status monitoring hook
 * Monitors browser online/offline events and periodically verifies connectivity via PingEndpoint
 */
export const useNetworkStatus = (): NetworkStatus & {
  checkNow: () => Promise<void>;
} => {
  const isOnline = useAppStatusStore((s) => s.isOnline);
  const lastChecked = useAppStatusStore((s) => s.lastChecked);
  const reason = useAppStatusStore((s) => s.reason);
  const isMounted = useRef(true);

  const checkConnectivity = useCallback(async () => {
    const setNetworkStatus = useAppStatusStore.getState().setNetworkStatus;

    try {
      const result = await PingEndpoint(DEFAULT_PING_TARGET, PING_TIMEOUT);
      if (!isMounted.current) return;
      if (result.online) {
        setNetworkStatus(true, "ping-success");
      } else {
        setNetworkStatus(false, result.error || "ping-failed");
      }
    } catch (error) {
      if (!isMounted.current) return;
      const message = error instanceof Error ? error.message : "ping-error";
      logger.error("network.check", "Ping failed", { error: message });
      setNetworkStatus(false, message);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const setNetworkStatus = useAppStatusStore.getState().setNetworkStatus;

    // Browser event listeners
    const handleOnline = () => {
      setNetworkStatus(true, "browser-event");
      void checkConnectivity();
    };

    const handleOffline = () => {
      setNetworkStatus(false, "browser-event");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    void checkConnectivity();

    // Set up periodic checks
    const interval = setInterval(() => {
      void checkConnectivity();
    }, PING_INTERVAL);

    return () => {
      isMounted.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  const checkNow = useCallback(async () => {
    const setNetworkStatus = useAppStatusStore.getState().setNetworkStatus;

    try {
      const result = await PingEndpoint(DEFAULT_PING_TARGET, PING_TIMEOUT);
      if (result.online) {
        setNetworkStatus(true, "manual-check");
      } else {
        setNetworkStatus(false, result.error || "ping-failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "ping-error";
      logger.error("network.checkNow", "Manual ping failed", { error: message });
      setNetworkStatus(false, message);
    }
  }, []);

  return {
    isOnline,
    lastChecked,
    reason,
    checkNow,
  };
};
