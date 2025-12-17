import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { usePreferencesStore } from "@/state/preferences";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

// Speed limit constants: use decimal MB (1 MB = 1,000,000 bytes)
const BYTES_PER_MB = 1_000_000;

function bytesToMB(bytes: number): number {
  return bytes / BYTES_PER_MB;
}

function mbToBytes(mb: number): number {
  return Math.round(mb * BYTES_PER_MB);
}

export function TransferCacheCard() {
  const { t } = useTranslation();

  const workerCount = usePreferencesStore((state) => state.maxConcurrentTransfers);
  const globalSpeedLimit = usePreferencesStore((state) => state.transferSpeedLimitBytes);
  const setWorkerCount = usePreferencesStore((state) => state.setMaxConcurrentTransfers);
  const setSpeedLimit = usePreferencesStore((state) => state.setTransferSpeedLimit);

  const [speedLimitInput, setSpeedLimitInput] = useState("");

  useEffect(() => {
    if (globalSpeedLimit === 0) {
      setSpeedLimitInput("");
    } else {
      const mb = bytesToMB(globalSpeedLimit);
      setSpeedLimitInput(Number.isInteger(mb) ? String(mb) : mb.toFixed(1));
    }
  }, [globalSpeedLimit]);

  const handleWorkerCountChange = (val: number[]) => {
    if (val.length > 0) {
      setWorkerCount(val[0]);
    }
  };

  const handleSpeedLimitChangeMB = (mbValue: number) => {
    const bytes = mbToBytes(Math.max(0, mbValue));
    setSpeedLimit(bytes);
  };

  const handleSpeedLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setSpeedLimitInput(value);
    }
  };

  const handleSpeedLimitInputBlur = () => {
    const val = parseFloat(speedLimitInput);
    if (!isNaN(val) && val >= 0) {
      handleSpeedLimitChangeMB(val);
    } else {
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
