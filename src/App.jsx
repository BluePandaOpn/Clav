import React, { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import ToastStack from "./components/ToastStack.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import VaultPage from "./pages/VaultPage.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { useCredentials } from "./hooks/useCredentials.js";
import { useToasts } from "./hooks/useToasts.js";

export default function App() {
  const { items, loading, error, addItem, removeItem, clearAll, refresh } = useCredentials();
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
    setGeneratedPassword
  };

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
