import React from "react";
import { KeyRound, LayoutDashboard, LockKeyhole, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vault", label: "Vault", icon: LockKeyhole },
  { to: "/generator", label: "Generator", icon: KeyRound },
  { to: "/settings", label: "Settings", icon: Settings }
];

export default function AppShell({ children }) {
  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">PM</div>
          <div>
            <h1>Password Manager</h1>
            <p>Professional Vault</p>
          </div>
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
      <main className="content">{children}</main>
    </div>
  );
}
