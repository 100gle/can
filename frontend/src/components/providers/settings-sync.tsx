import { usePreferencesStore } from "@/state/preferences";
import { SetTransferConcurrency, SetTransferSpeedLimit } from "@wailsjs/go/app/App";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function SettingsSync() {
  const { i18n } = useTranslation();

  // Selectors
  const language = usePreferencesStore((state) => state.language);
  const maxConcurrentTransfers = usePreferencesStore((state) => state.maxConcurrentTransfers);
  const transferSpeedLimitBytes = usePreferencesStore((state) => state.transferSpeedLimitBytes);

  // Sync Language
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Sync Transfer Settings (Concurrency)
  useEffect(() => {
    SetTransferConcurrency(maxConcurrentTransfers).catch((err) => {
      console.error("Failed to sync transfer concurrency:", err);
    });
  }, [maxConcurrentTransfers]);

  // Sync Transfer Settings (Speed Limit)
  useEffect(() => {
    SetTransferSpeedLimit(transferSpeedLimitBytes).catch((err) => {
      console.error("Failed to sync transfer speed limit:", err);
    });
  }, [transferSpeedLimitBytes]);

  return null;
}
