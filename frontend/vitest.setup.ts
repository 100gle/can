import "fake-indexeddb/auto";

import { vi } from "vitest";

vi.mock("@wailsjs/go/app/App", () => ({
  CheckForUpdates: vi.fn().mockResolvedValue({
    updateAvailable: false,
    latestVersion: "",
    releaseNotes: "",
    releaseURL: "",
  }),
  GetSystemMetrics: vi.fn().mockResolvedValue({
    memoryAlloc: 0,
    memorySys: 0,
    numGoroutines: 0,
    activeTransfers: 0,
  }),
  SaveFileDialog: vi.fn().mockResolvedValue(""),
  SelectLocalFolder: vi.fn().mockResolvedValue(""),
}));

vi.mock("@wailsjs/runtime/runtime", () => ({
  EventsOn: vi.fn(() => () => {}),
}));
