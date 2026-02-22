import React from "react";
import { AlertTriangle, KeyRound, Shield, Sparkles } from "lucide-react";
import { getStrengthScore } from "../utils/password.js";

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
  const nonHoneyItems = items.filter((item) => !item.isHoney);
  const weakItems = nonHoneyItems.filter((item) => getStrengthScore(item.password || "") <= 2);
  const oldItems = nonHoneyItems.filter((item) => {
    const ts = Date.parse(item.updatedAt || item.createdAt || "");
    if (Number.isNaN(ts)) return false;
    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return ageDays >= 180;
  });
  const duplicateGroups = buildDuplicateGroups(nonHoneyItems);
  const duplicatedCount = duplicateGroups.reduce((acc, group) => acc + group.items.length, 0);
  const auditBars = [
    {
      key: "weak",
      label: "Debiles",
      value: weakItems.length,
      total: nonHoneyItems.length,
      tone: "weak"
    },
    {
      key: "duplicates",
      label: "Duplicadas",
      value: duplicatedCount,
      total: nonHoneyItems.length,
      tone: "warning"
    },
    {
      key: "old",
      label: "Antiguas (+180 dias)",
      value: oldItems.length,
      total: nonHoneyItems.length,
      tone: "medium"
    }
  ];

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

      <section className="panel audit-panel">
        <h3>2.5 Auditoria visual</h3>
        <p className="muted">Metricas de riesgo sobre contrasenas debiles, duplicadas y antiguas.</p>
        <div className="audit-bars">
          {auditBars.map((bar) => {
            const total = Math.max(1, bar.total);
            const pct = Math.min(100, Math.round((bar.value / total) * 100));
            return (
              <article key={bar.key} className="audit-bar-card">
                <div className="audit-bar-head">
                  <strong>{bar.label}</strong>
                  <span>
                    {bar.value}/{bar.total} ({pct}%)
                  </span>
                </div>
                <div className="audit-track">
                  <div className={`audit-fill ${bar.tone}`} style={{ width: `${pct}%` }} />
                </div>
              </article>
            );
          })}
        </div>

        <div className="audit-details">
          <article className="panel">
            <h4>Duplicadas (grupos)</h4>
            {duplicateGroups.length === 0 ? <p className="muted">Sin duplicadas.</p> : null}
            <ul className="security-list">
              {duplicateGroups.slice(0, 5).map((group, idx) => (
                <li key={`dup-${idx}`}>
                  <strong>{group.items.length} credenciales comparten password</strong>
                  <small>
                    {presentationModeEnabled
                      ? "[PRESENTATION_MODE]"
                      : group.items.map((item) => item.service).join(", ")}
                  </small>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h4>Antiguas (+180 dias)</h4>
            {oldItems.length === 0 ? <p className="muted">Sin credenciales antiguas.</p> : null}
            <ul className="security-list">
              {oldItems.slice(0, 5).map((item) => (
                <li key={`old-${item.id}`}>
                  <strong>{item.service}</strong>
                  <small>
                    Ultimo cambio: {new Date(item.updatedAt || item.createdAt).toLocaleDateString("es-ES")}
                  </small>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </section>
  );
}

function buildDuplicateGroups(items) {
  const byPassword = new Map();
  for (const item of items) {
    const key = String(item.password || "");
    if (!key || key.startsWith("[")) continue;
    const current = byPassword.get(key) || [];
    current.push(item);
    byPassword.set(key, current);
  }
  return Array.from(byPassword.values())
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length);
}
