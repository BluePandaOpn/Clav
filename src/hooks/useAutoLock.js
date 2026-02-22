import { useEffect, useRef } from "react";

export function useAutoLock({
  enabled,
  isUnlocked,
  inactivityMs,
  onLock,
  onAutoLock,
  immediateLockDelayMs = 1200,
  lockOnTabHidden = true,
  lockOnBlur = true,
  lockOnMouseLeave = true
}) {
  const inactivityTimerRef = useRef(null);
  const immediateTimerRef = useRef(null);
  const pendingReasonRef = useRef("");
  const lockingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isUnlocked) return undefined;

    const clearInactivityTimer = () => {
      if (!inactivityTimerRef.current) return;
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    };

    const clearImmediateTimer = () => {
      if (!immediateTimerRef.current) return;
      window.clearTimeout(immediateTimerRef.current);
      immediateTimerRef.current = null;
      pendingReasonRef.current = "";
    };

    const triggerLock = (reason) => {
      if (lockingRef.current) return;
      lockingRef.current = true;
      clearInactivityTimer();
      clearImmediateTimer();
      onLock?.();
      onAutoLock?.(reason);
      window.setTimeout(() => {
        lockingRef.current = false;
      }, 250);
    };

    const scheduleImmediateLock = (reason) => {
      clearImmediateTimer();
      pendingReasonRef.current = reason;
      const safeDelay = Math.max(0, Number(immediateLockDelayMs) || 0);
      immediateTimerRef.current = window.setTimeout(() => {
        triggerLock(reason);
      }, safeDelay);
    };

    const resetInactivityTimer = () => {
      clearInactivityTimer();
      if (!Number.isFinite(inactivityMs) || inactivityMs <= 0) return;
      inactivityTimerRef.current = window.setTimeout(() => {
        triggerLock("inactivity");
      }, inactivityMs);
    };

    const onVisibilityChange = () => {
      if (document.hidden && lockOnTabHidden) {
        scheduleImmediateLock("tab_hidden");
        return;
      }
      clearImmediateTimer();
      resetInactivityTimer();
    };

    const onWindowBlur = () => {
      if (!lockOnBlur) return;
      scheduleImmediateLock("focus_lost");
    };

    const onWindowFocus = () => {
      if (pendingReasonRef.current === "focus_lost" || pendingReasonRef.current === "tab_hidden") {
        clearImmediateTimer();
      }
      resetInactivityTimer();
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
        scheduleImmediateLock("mouse_left_window");
      }
    };

    const onUserActivity = () => {
      if (pendingReasonRef.current === "mouse_left_window" || pendingReasonRef.current === "focus_lost") {
        clearImmediateTimer();
      }
      resetInactivityTimer();
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onUserActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("mouseout", onMouseOut);

    resetInactivityTimer();

    return () => {
      clearInactivityTimer();
      clearImmediateTimer();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onUserActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("mouseout", onMouseOut);
    };
  }, [
    enabled,
    isUnlocked,
    inactivityMs,
    onLock,
    onAutoLock,
    immediateLockDelayMs,
    lockOnTabHidden,
    lockOnBlur,
    lockOnMouseLeave
  ]);
}
