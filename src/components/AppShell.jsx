import React from "react";
import {
  Command,
  LayoutDashboard,
  LockKeyhole,
  WandSparkles,
  ShieldAlert,
  Laptop,
  Settings,
  UserRound,
  Plus,
  Search
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vault", label: "Vault", icon: LockKeyhole },
  { to: "/generator", label: "Generador", icon: WandSparkles },
  { to: "/audit", label: "Auditoria", icon: ShieldAlert },
  { to: "/devices", label: "Dispositivos", icon: Laptop },
  { to: "/settings", label: "Configuracion", icon: Settings },
  { to: "/account", label: "Cuenta", icon: UserRound }
];

export default function AppShell({ children, offlineMode = false, pendingSyncCount = 0 }) {
  const appName = import.meta.env.VITE_APP_NAME || "Password Manager";
  const navigate = useNavigate();

  const submitGlobalSearch = (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.global_search;
    const value = String(input?.value || "").trim();
    localStorage.setItem("vault_search", value);
    navigate("/vault");
  };

  const goToAdd = () => {
    navigate("/vault");
  };

  return (
    <div className="app-root">
      <aside className="sidebar fixed-sidebar">
        <div className="brand">
          <div className="brand-logo">
            <Command size={20} />
          </div>
          <div>
            <h1>{appName}_</h1>
            <p>Professional Vault</p>
          </div>
        </div>
        <div className="status-chip">
          <span className="status-dot" />
          <span>ENCRYPTED_AES_256</span>
        </div>
        <nav className="menu">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                className={({ isActive }) => `menu-link ${isActive ? "active" : ""}`}
                to={link.to}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="content app-content">
        <header className="topbar">
          <form className="topbar-search" onSubmit={submitGlobalSearch}>
            <Search size={15} />
            <input name="global_search" placeholder="Buscar en el vault..." />
          </form>
          <div className="topbar-actions">
            <button className="primary-btn" type="button" onClick={goToAdd}>
              <Plus size={14} /> Anadir
            </button>
            <span className={`sync-state ${offlineMode ? "offline" : "online"}`}>
              {offlineMode ? `Offline (${pendingSyncCount})` : pendingSyncCount > 0 ? `Pendiente: ${pendingSyncCount}` : "Sincronizado"}
            </span>
            <div className="avatar-chip">US</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
