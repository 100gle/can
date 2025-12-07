import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LockStrategy = "lock" | "logout";
export type LockReason = "idle" | "logout";

type SessionState = {
  idleTimeoutMinutes: number;
  lockStrategy: LockStrategy;
  locked: boolean;
  lockReason: LockReason | null;
  setIdleTimeout: (minutes: number) => void;
  setLockStrategy: (strategy: LockStrategy) => void;
  lock: (reason: LockReason) => void;
  unlock: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      idleTimeoutMinutes: 15,
      lockStrategy: "lock",
      locked: false,
      lockReason: null,
      setIdleTimeout: (minutes) =>
        set({
          idleTimeoutMinutes: minutes,
        }),
      setLockStrategy: (strategy) =>
        set({
          lockStrategy: strategy,
        }),
      lock: (reason) =>
        set({
          locked: true,
          lockReason: reason,
        }),
      unlock: () =>
        set({
          locked: false,
          lockReason: null,
        }),
    }),
    {
      name: "can:session-security",
      partialize: (state) => ({
        idleTimeoutMinutes: state.idleTimeoutMinutes,
        lockStrategy: state.lockStrategy,
      }),
    },
  ),
);
