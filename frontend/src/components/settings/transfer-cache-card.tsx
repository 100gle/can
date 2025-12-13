import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

// Speed limit constants: use decimal MB (1 MB = 1,000,000 bytes) for network speed
// This aligns with how network speeds are typically displayed (e.g., ISP speeds)
const BYTES_PER_MB = 1_000_000;

// Convert bytes to MB (decimal)
function bytesToMB(bytes: number): number {
  return bytes / BYTES_PER_MB;
}

// Convert MB to bytes (decimal)
function mbToBytes(mb: number): number {
  return Math.round(mb * BYTES_PER_MB);
}

export function TransferCacheCard() {
  const { t } = useTranslation();
  const workerCount = useTransfersStore((state) => state.workerCount);
  const globalSpeedLimit = useTransfersStore((state) => state.globalSpeedLimit);
  // Input stored as MB string for user-friendly display
  const [speedLimitInput, setSpeedLimitInput] = useState("");

  // Sync input with store value (convert bytes to MB)
  useEffect(() => {
    if (globalSpeedLimit === 0) {
      setSpeedLimitInput("");
    } else {
      const mb = bytesToMB(globalSpeedLimit);
      // Show integer if whole number, otherwise 1 decimal place
      setSpeedLimitInput(Number.isInteger(mb) ? String(mb) : mb.toFixed(1));
    }
  }, [globalSpeedLimit]);

  const handleWorkerCountChange = (val: number[]) => {
    if (val.length > 0) {
      void transfersStore.setWorkerCount(val[0]);
    }
  };

  // Set speed limit from MB value
  const handleSpeedLimitChangeMB = (mbValue: number) => {
    const bytes = mbToBytes(Math.max(0, mbValue));
    void transfersStore.setGlobalSpeedLimit(bytes);
  };

  const handleSpeedLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, digits, and one decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setSpeedLimitInput(value);
    }
  };

  const handleSpeedLimitInputBlur = () => {
    const val = parseFloat(speedLimitInput);
    if (!isNaN(val) && val >= 0) {
      handleSpeedLimitChangeMB(val);
    } else {
      // Reset to current value
      if (globalSpeedLimit === 0) {
        setSpeedLimitInput("");
      } else {
        const mb = bytesToMB(globalSpeedLimit);
        setSpeedLimitInput(Number.isInteger(mb) ? String(mb) : mb.toFixed(1));
      }
    }
  };

  const handleSpeedLimitInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSpeedLimitInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  // Increment/decrement by 1 MB
  const incrementSpeed = () => {
    const currentMB = bytesToMB(globalSpeedLimit);
    handleSpeedLimitChangeMB(Math.floor(currentMB) + 1);
  };

  const decrementSpeed = () => {
    const currentMB = bytesToMB(globalSpeedLimit);
    const newMB = Math.max(0, Math.floor(currentMB) - 1);
    handleSpeedLimitChangeMB(newMB);
  };

  return (
    <SettingsSection title={t("settings.transfer.title")} description={t("settings.transfer.desc")}>
      {/* Concurrency Workers */}
      <SettingsItem
        label={t("settings.transfer.workers")}
        description={t("settings.transfer.workersDesc")}
      >
        <div className="flex items-center gap-3">
          <div className="py-2">
            <Slider
              min={1}
              max={16}
              step={1}
              value={[workerCount]}
              onValueChange={handleWorkerCountChange}
              className="w-[160px]"
            />
          </div>
          <span className="text-sm font-medium w-6 text-center tabular-nums">{workerCount}</span>
        </div>
      </SettingsItem>

      {/* Speed Limit with vertical spinner buttons */}
      <SettingsItem
        label={t("settings.transfer.speedLimit")}
        description={t("settings.transfer.speedLimitDesc")}
        showSeparator={false}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={speedLimitInput}
              onChange={handleSpeedLimitInputChange}
              onBlur={handleSpeedLimitInputBlur}
              onKeyDown={handleSpeedLimitInputKeyDown}
              className="w-[80px] text-center pr-7"
            />
            {/* Vertical spinner buttons */}
            <div className="absolute right-0 inset-y-0 flex flex-col border-l">
              <button
                type="button"
                onClick={incrementSpeed}
                className="flex-1 px-1.5 hover:bg-muted/50 transition-colors rounded-tr-md border-b"
                tabIndex={-1}
              >
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={decrementSpeed}
                disabled={globalSpeedLimit === 0}
                className="flex-1 px-1.5 hover:bg-muted/50 transition-colors rounded-br-md disabled:opacity-50"
                tabIndex={-1}
              >
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">MB/s</span>
        </div>
      </SettingsItem>
    </SettingsSection>
  );
}
