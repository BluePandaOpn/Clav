import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import MasterPasswordGate from "./components/MasterPasswordGate.jsx";
import ToastStack from "./components/ToastStack.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import VaultPage from "./pages/VaultPage.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import UnlockQrPage from "./pages/UnlockQrPage.jsx";
import { useCredentials } from "./hooks/useCredentials.js";
import { useAutoLock } from "./hooks/useAutoLock.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useToasts } from "./hooks/useToasts.js";
import { useVaultSecurity } from "./hooks/useVaultSecurity.js";

export default function App() {
  const location = useLocation();
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
    scanCredentialBreaches
  } = useCredentials(security);
  const { toasts, pushToast, removeToast } = useToasts();
  const [generatedPassword, setGeneratedPassword] = useState("");
  const seenCompromisedRef = useRef(new Set());
  const [autoLockEnabled, setAutoLockEnabled] = useLocalStorage("vault_auto_lock_enabled_v016", true);
  const [autoLockMinutes, setAutoLockMinutes] = useLocalStorage("vault_auto_lock_minutes_v016", 5);

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

  useAutoLock({
    enabled: Boolean(autoLockEnabled),
    isUnlocked: security.isUnlocked,
    inactivityMs: Math.max(0.25, Number(autoLockMinutes) || 5) * 60 * 1000,
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
    pushToast,
    generatedPassword,
    setGeneratedPassword,
    security,
    autoLockEnabled,
    setAutoLockEnabled,
    autoLockMinutes,
    setAutoLockMinutes
  };

  if (location.pathname === "/unlock-qr") {
    return (
      <>
        <Routes>
          <Route path="/unlock-qr" element={<UnlockQrPage pushToast={pushToast} />} />
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
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage stats={stats} {...shared} />} />
        <Route path="/vault" element={<VaultPage {...shared} />} />
        <Route path="/generator" element={<GeneratorPage {...shared} />} />
        <Route path="/settings" element={<SettingsPage {...shared} />} />
      </Routes>
      <ToastStack items={toasts} onClose={removeToast} />
    </AppShell>
  );
}
