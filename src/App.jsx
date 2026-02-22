import React, { useMemo, useState } from "react";
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
import { useToasts } from "./hooks/useToasts.js";
import { useVaultSecurity } from "./hooks/useVaultSecurity.js";

export default function App() {
  const location = useLocation();
  const security = useVaultSecurity();
  const { items, loading, error, addItem, removeItem, clearAll, refresh } = useCredentials(security);
  const { toasts, pushToast, removeToast } = useToasts();
  const [generatedPassword, setGeneratedPassword] = useState("");

  const stats = useMemo(() => {
    const total = items.length;
    const recent = items.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      const delta = Date.now() - created;
      return delta < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, recent };
  }, [items]);

  const shared = {
    items,
    loading,
    error,
    addItem,
    removeItem,
    clearAll,
    refresh,
    pushToast,
    generatedPassword,
    setGeneratedPassword,
    security
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
