import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import MasterPasswordGate from "./components/MasterPasswordGate.jsx";
import ToastStack from "./components/ToastStack.jsx";
import SpotlightSearch from "./components/SpotlightSearch.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import VaultPage from "./pages/VaultPage.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import UnlockQrPage from "./pages/UnlockQrPage.jsx";
import AuditPage from "./pages/AuditPage.jsx";
import DevicesPage from "./pages/DevicesPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import { useCredentials } from "./hooks/useCredentials.js";
import { useAutoLock } from "./hooks/useAutoLock.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useToasts } from "./hooks/useToasts.js";
import { useVaultSecurity } from "./hooks/useVaultSecurity.js";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const security = useVaultSecurity();
  const {
    items,
    loading,
    error,
    addItem,
    removeItem,
    clearAll,
    refresh,
    generateHoneyPasswords,
    triggerHoneyAccess,
    checkCredentialBreach,
    scanCredentialBreaches,
    getCredentialHistory,
    updateRotationPolicy,
    rotateCredentialNow,
    rotateDueNow,
    listRotationDue,
    offlineMode,
    pendingSyncCount,
    syncNow
  } = useCredentials(security);
  const { toasts, pushToast, removeToast } = useToasts();
  const [generatedPassword, setGeneratedPassword] = useState("");
  const seenCompromisedRef = useRef(new Set());
  const [autoLockEnabled, setAutoLockEnabled] = useLocalStorage("vault_auto_lock_enabled_v016", true);
  const [autoLockMinutes, setAutoLockMinutes] = useLocalStorage("vault_auto_lock_minutes_v016", 5);
  const [autoLockGraceSeconds, setAutoLockGraceSeconds] = useLocalStorage("vault_auto_lock_grace_secs_v016", 1.5);
  const [travelModeEnabled, setTravelModeEnabled] = useLocalStorage("vault_travel_mode_enabled_v022", false);
  const [travelModeDurationMinutes, setTravelModeDurationMinutes] = useLocalStorage(
    "vault_travel_mode_duration_minutes_v022",
    60
  );
  const [travelModeExpiresAt, setTravelModeExpiresAt] = useLocalStorage("vault_travel_mode_expires_at_v022", null);
  const travelModeActive = Boolean(travelModeEnabled && travelModeExpiresAt && Date.now() < travelModeExpiresAt);
  const [presentationModeEnabled, setPresentationModeEnabled] = useLocalStorage(
    "vault_presentation_mode_enabled_v023",
    false
  );
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  const stats = useMemo(() => {
    const total = items.length;
    const recent = items.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      const delta = Date.now() - created;
      return delta < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, recent };
  }, [items]);

  useEffect(() => {
    const seen = seenCompromisedRef.current;
    for (const item of items) {
      const compromised = Boolean(item?.breachStatus?.compromised);
      if (!compromised) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      pushToast(`ALERTA: password comprometida en ${item.service}`, "error");
    }

    const currentIds = new Set(items.map((item) => item.id));
    for (const id of Array.from(seen)) {
      if (!currentIds.has(id)) seen.delete(id);
    }
  }, [items, pushToast]);

  useEffect(() => {
    if (!travelModeEnabled || !travelModeExpiresAt) return undefined;

    const checkExpiration = () => {
      if (Date.now() < Number(travelModeExpiresAt)) return;
      setTravelModeEnabled(false);
      setTravelModeExpiresAt(null);
      pushToast("Modo viaje finalizado automaticamente", "info");
    };

    checkExpiration();
    const timer = window.setInterval(checkExpiration, 15000);
    return () => window.clearInterval(timer);
  }, [travelModeEnabled, travelModeExpiresAt, setTravelModeEnabled, setTravelModeExpiresAt, pushToast]);

  useAutoLock({
    enabled: Boolean(autoLockEnabled),
    isUnlocked: security.isUnlocked,
    inactivityMs: Math.max(0.25, Number(autoLockMinutes) || 5) * 60 * 1000,
    immediateLockDelayMs: Math.max(0, Number(autoLockGraceSeconds) || 0) * 1000,
    onLock: security.lock,
    onAutoLock: (reason) => {
      const reasonLabel =
        reason === "inactivity"
          ? "inactividad"
          : reason === "tab_hidden"
            ? "cambio de pestana"
            : reason === "focus_lost"
              ? "perdida de foco"
              : reason === "mouse_left_window"
                ? "salida del mouse de la ventana"
                : "evento de seguridad";
      pushToast(`Boveda bloqueada automaticamente por ${reasonLabel}`, "info");
    }
  });

  const activateTravelMode = (minutes = travelModeDurationMinutes) => {
    const safeMinutes = Math.max(1, Math.min(24 * 60, Number(minutes) || 60));
    setTravelModeDurationMinutes(safeMinutes);
    setTravelModeExpiresAt(Date.now() + safeMinutes * 60 * 1000);
    setTravelModeEnabled(true);
    pushToast(`Modo viaje activado por ${safeMinutes} minuto(s)`, "info");
  };

  const deactivateTravelMode = () => {
    setTravelModeEnabled(false);
    setTravelModeExpiresAt(null);
    pushToast("Modo viaje desactivado", "info");
  };

  const activatePresentationMode = () => {
    setPresentationModeEnabled(true);
    pushToast("Modo presentacion activado", "info");
  };

  const deactivatePresentationMode = () => {
    setPresentationModeEnabled(false);
    pushToast("Modo presentacion desactivado", "info");
  };

  useEffect(() => {
    const isTypingContext = (target) => {
      if (!target || typeof target.closest !== "function") return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    };

    const onKeyDown = (event) => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!shortcut) return;
      if (!security.isUnlocked) return;
      if (isTypingContext(event.target)) return;
      event.preventDefault();
      setSpotlightOpen((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [security.isUnlocked]);

  const dispatchVaultSpotlightAction = (detail) => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("vault:spotlight-action", { detail }));
    });
  };

  const openSpotlightCreate = () => {
    localStorage.setItem("vault_search", JSON.stringify(""));
    localStorage.setItem("vault_category_v062", JSON.stringify("ALL"));
    navigate("/vault");
    setSpotlightOpen(false);
    dispatchVaultSpotlightAction({ action: "create" });
  };

  const openSpotlightEdit = (item) => {
    if (!item?.id) return;
    localStorage.setItem("vault_search", JSON.stringify(""));
    localStorage.setItem("vault_category_v062", JSON.stringify("ALL"));
    navigate("/vault");
    setSpotlightOpen(false);
    dispatchVaultSpotlightAction({ action: "edit", itemId: item.id });
  };

  const openSpotlightItem = (item) => {
    if (!item?.id) return;
    localStorage.setItem("vault_search", JSON.stringify(""));
    localStorage.setItem("vault_category_v062", JSON.stringify("ALL"));
    navigate("/vault");
    setSpotlightOpen(false);
    dispatchVaultSpotlightAction({ action: "open", itemId: item.id });
  };

  const openSpotlightGenerator = () => {
    navigate("/generator");
    setSpotlightOpen(false);
  };

  const shared = {
    items,
    loading,
    error,
    addItem,
    removeItem,
    clearAll,
    refresh,
    generateHoneyPasswords,
    triggerHoneyAccess,
    checkCredentialBreach,
    scanCredentialBreaches,
    getCredentialHistory,
    updateRotationPolicy,
    rotateCredentialNow,
    rotateDueNow,
    listRotationDue,
    offlineMode,
    pendingSyncCount,
    syncNow,
    pushToast,
    generatedPassword,
    setGeneratedPassword,
    security,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockMinutes,
    setAutoLockMinutes,
    autoLockGraceSeconds,
    setAutoLockGraceSeconds,
    travelModeActive,
    travelModeEnabled,
    travelModeDurationMinutes,
    setTravelModeDurationMinutes,
    travelModeExpiresAt,
    activateTravelMode,
    deactivateTravelMode,
    presentationModeEnabled,
    activatePresentationMode,
    deactivatePresentationMode
  };

  if (pathname === "/unlock-qr") {
    return (
      <>
        <Routes>
          <Route path="/unlock-qr" element={<UnlockQrPage pushToast={pushToast} />} />
          <Route path="*" element={<Navigate to="/unlock-qr" replace />} />
        </Routes>
        <ToastStack items={toasts} onClose={removeToast} />
      </>
    );
  }

  if (!security.isUnlocked) {
    return (
      <>
        <MasterPasswordGate
          isConfigured={security.isConfigured}
          onUnlock={security.unlock}
          onSetup={security.setupMasterPassword}
        />
        <ToastStack items={toasts} onClose={removeToast} />
      </>
    );
  }

  return (
    <AppShell
      offlineMode={offlineMode}
      pendingSyncCount={pendingSyncCount}
      onOpenSpotlight={() => setSpotlightOpen(true)}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage stats={stats} {...shared} />} />
        <Route path="/vault" element={<VaultPage {...shared} />} />
        <Route path="/generator" element={<GeneratorPage {...shared} />} />
        <Route path="/audit" element={<AuditPage {...shared} />} />
        <Route path="/devices" element={<DevicesPage {...shared} />} />
        <Route path="/settings" element={<SettingsPage {...shared} />} />
        <Route path="/account" element={<AccountPage {...shared} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <SpotlightSearch
        open={spotlightOpen}
        items={items}
        onClose={() => setSpotlightOpen(false)}
        onOpenCreate={openSpotlightCreate}
        onOpenEdit={openSpotlightEdit}
        onOpenItem={openSpotlightItem}
        onOpenGenerate={openSpotlightGenerator}
      />
      <ToastStack items={toasts} onClose={removeToast} />
    </AppShell>
  );
}
