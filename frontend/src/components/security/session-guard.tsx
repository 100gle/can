import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { LockReason, useSessionStore } from "@/state/session";
import type { PropsWithChildren } from "react";

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

export const SessionGuard = ({ children }: PropsWithChildren) => {
  const idleTimeoutMinutes = useSessionStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = useSessionStore((state) => state.lockStrategy);
  const locked = useSessionStore((state) => state.locked);
  const lockReason = useSessionStore((state) => state.lockReason);
  const lock = useSessionStore((state) => state.lock);
  const unlock = useSessionStore((state) => state.unlock);

  const timeout = idleTimeoutMinutes > 0 ? minutesToMs(idleTimeoutMinutes) : 0;

  const { reset } = useIdleTimer({
    timeout,
    onIdle: () => {
      const reason: LockReason = lockStrategy === "logout" ? "logout" : "idle";
      lock(reason);
      if (reason === "logout") {
        // Give user a hint before forcing reload so pending work can be saved.
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
    onActive: () => {
      if (!locked) return;
    },
  });

  const handleUnlock = () => {
    if (lockReason === "logout") {
      window.location.reload();
      return;
    }
    unlock();
    reset();
  };

  return (
    <>
      {children}
      {locked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>会话已锁定</CardTitle>
              <CardDescription>
                {lockReason === "logout"
                  ? "由于长时间未操作，已自动注销。请重新加载继续使用。"
                  : `超过 ${idleTimeoutMinutes} 分钟无操作，出于安全考虑已锁屏。`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-3">
              <Button onClick={handleUnlock} size="lg">
                {lockReason === "logout" ? "重新加载" : "解锁继续"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
};
