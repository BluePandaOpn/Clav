import { useEffect, useRef } from "react";

export function useAutoLock({
  enabled,
  isUnlocked,
  inactivityMs,
  onLock,
  onAutoLock,
  lockOnTabHidden = true,
  lockOnBlur = true,
  lockOnMouseLeave = true
}) {
  const timerRef = useRef(null);
  const lockingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isUnlocked) return undefined;

    const clearTimer = () => {
      if (!timerRef.current) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const triggerLock = (reason) => {
      if (lockingRef.current) return;
      lockingRef.current = true;
      clearTimer();
      onLock?.();
      onAutoLock?.(reason);
      window.setTimeout(() => {
        lockingRef.current = false;
      }, 250);
    };

    const resetInactivityTimer = () => {
      clearTimer();
      if (!Number.isFinite(inactivityMs) || inactivityMs <= 0) return;
      timerRef.current = window.setTimeout(() => {
        triggerLock("inactivity");
      }, inactivityMs);
    };

    const onVisibilityChange = () => {
      if (document.hidden && lockOnTabHidden) {
        triggerLock("tab_hidden");
        return;
      }
      resetInactivityTimer();
    };

    const onWindowBlur = () => {
      if (!lockOnBlur) return;
      triggerLock("focus_lost");
    };

    const onMouseOut = (event) => {
      if (!lockOnMouseLeave) return;
      const toElement = event.relatedTarget || event.toElement;
      if (toElement) return;
      const leftWindow =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight;
      if (leftWindow) {
        triggerLock("mouse_left_window");
      }
    };

    const onUserActivity = () => {
      resetInactivityTimer();
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onUserActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("mouseout", onMouseOut);

    resetInactivityTimer();

    return () => {
      clearTimer();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onUserActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("mouseout", onMouseOut);
    };
  }, [
    enabled,
    isUnlocked,
    inactivityMs,
    onLock,
    onAutoLock,
    lockOnTabHidden,
    lockOnBlur,
    lockOnMouseLeave
  ]);
}
