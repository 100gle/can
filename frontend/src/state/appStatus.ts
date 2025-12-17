import { EventsEmit } from "@wailsjs/runtime/runtime";
import { create } from "zustand";
import { bindStore } from "./utils";

type NetworkTelemetry = {
  offlinePauseCount: number;
  resumeSuccessCount: number;
};

type AppStatusState = {
  isOnline: boolean;
  lastChecked: number | null;
  reason: string;
  telemetry: NetworkTelemetry;
};

type AppStatusActions = {
  setNetworkStatus: (online: boolean, reason: string) => void;
  incrementOfflinePause: () => void;
  incrementResumeSuccess: () => void;
};

type AppStatusStore = AppStatusState & AppStatusActions;

const createInitialState = (): AppStatusState => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastChecked: null,
  reason: "初始状态",
  telemetry: {
    offlinePauseCount: 0,
    resumeSuccessCount: 0,
  },
});

const useAppStatusStoreBase = create<AppStatusStore>((set, get) => ({
  ...createInitialState(),

  setNetworkStatus: (online: boolean, reason: string) => {
    const previous = get().isOnline;
    const now = Date.now();

    // Avoid unnecessary updates
    if (previous === online && get().reason === reason) {
      return;
    }

    // Calculate telemetry updates
    let telemetryUpdate: Partial<NetworkTelemetry> = {};
    if (!online && previous) {
      telemetryUpdate = { offlinePauseCount: get().telemetry.offlinePauseCount + 1 };
    } else if (online && !previous) {
      telemetryUpdate = { resumeSuccessCount: get().telemetry.resumeSuccessCount + 1 };
    }

    // Single atomic update
    set((state) => ({
      isOnline: online,
      lastChecked: now,
      reason,
      telemetry: {
        ...state.telemetry,
        ...telemetryUpdate,
      },
    }));

    // Notify backend via Wails EventsEmit only if status changed
    if (previous !== online) {
      try {
        EventsEmit("app:network", {
          isOnline: online,
          reason,
        });
      } catch (error) {
        console.error("Failed to emit network event:", error);
      }
    }
  },

  incrementOfflinePause: () => {
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        offlinePauseCount: state.telemetry.offlinePauseCount + 1,
      },
    }));
  },

  incrementResumeSuccess: () => {
    set((state) => ({
      telemetry: {
        ...state.telemetry,
        resumeSuccessCount: state.telemetry.resumeSuccessCount + 1,
      },
    }));
  },
}));

const { useStore: useAppStatusStore, relay } = bindStore(useAppStatusStoreBase);

export { useAppStatusStore };

export const appStatusStore = {
  setNetworkStatus: relay((s) => s.setNetworkStatus),
  incrementOfflinePause: relay((s) => s.incrementOfflinePause),
  incrementResumeSuccess: relay((s) => s.incrementResumeSuccess),
  getState: () => useAppStatusStoreBase.getState(),
};
