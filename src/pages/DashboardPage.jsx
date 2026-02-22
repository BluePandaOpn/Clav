import React from "react";
import { AlertTriangle, KeyRound, Shield, Sparkles } from "lucide-react";

function Stat({ icon: Icon, label, value }) {
  return (
    <article className="stat">
      <Icon size={18} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default function DashboardPage({ items, stats, presentationModeEnabled }) {
  const latest = items.slice(0, 5);
  const compromised = items.filter((item) => item?.breachStatus?.compromised).length;
  return (
    <section>
      <header className="page-head">
        <h2>Dashboard</h2>
        <p>Resumen general de tu boveda de credenciales.</p>
      </header>

      <div className="stats-grid">
        <Stat icon={Shield} label="Total guardadas" value={stats.total} />
        <Stat icon={Sparkles} label="Ultimos 7 dias" value={stats.recent} />
        <Stat icon={KeyRound} label="Servicios unicos" value={new Set(items.map((i) => i.service)).size} />
        <Stat icon={AlertTriangle} label="Comprometidas" value={compromised} />
      </div>

      <section className="panel">
        <h3>Actividad reciente</h3>
        {latest.length === 0 ? (
          <p className="muted">No hay registros todavia.</p>
        ) : (
          <ul className="recent-list">
            {latest.map((item) => (
              <li key={item.id}>
                <strong>{item.service}</strong>
                <span>{presentationModeEnabled ? "[PRESENTATION_MODE]" : item.username || "sin usuario"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
