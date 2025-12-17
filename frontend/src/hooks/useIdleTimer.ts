import { useCallback, useEffect, useRef } from "react";

type UseIdleTimerOptions = {
  timeout: number;
  onIdle?: () => void;
  onActive?: () => void;
};

type UseIdleTimerResult = {
  reset: () => void;
};

export const useIdleTimer = ({
  timeout,
  onIdle,
  onActive,
}: UseIdleTimerOptions): UseIdleTimerResult => {
  const timerRef = useRef<number | null>(null);
  const idleRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const triggerIdle = useCallback(() => {
    if (!idleRef.current) {
      idleRef.current = true;
      onIdle?.();
    }
  }, [onIdle]);

  const reset = useCallback(() => {
    clearTimer();
    if (timeout <= 0) return;
    idleRef.current = false;
    timerRef.current = window.setTimeout(triggerIdle, timeout);
  }, [timeout, triggerIdle]);

  useEffect(() => {
    if (timeout <= 0) {
      clearTimer();
      idleRef.current = false;
      return;
    }
    const handleActivity = () => {
      if (idleRef.current) {
        idleRef.current = false;
        onActive?.();
      }
      reset();
    };
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleActivity, { passive: true });
    reset();
    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity as EventListenerOrEventListenerObject),
      );
      document.removeEventListener(
        "visibilitychange",
        handleActivity as EventListenerOrEventListenerObject,
      );
      clearTimer();
    };
  }, [timeout, onActive, reset]);

  return { reset };
};
