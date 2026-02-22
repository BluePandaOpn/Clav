import React from "react";
import { AlertTriangle, KeyRound, Shield, Sparkles } from "lucide-react";
import { getStrengthScore } from "../utils/password.js";
import { analyzeWeakPatterns } from "../utils/weakPatterns.js";

function Stat({ icon: Icon, label, value, hint, tone = "neutral" }) {
  return (
    <article className={`stat dashboard-stat ${tone}`}>
      <Icon size={18} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
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
  const weakPatternReport = analyzeWeakPatterns(nonHoneyItems);
  const duplicateGroups = weakPatternReport.duplicateGroups;
  const duplicatedCount = duplicateGroups.reduce((acc, group) => acc + group.items.length, 0);
  const totalRiskCount = weakItems.length + duplicatedCount + oldItems.length + weakPatternReport.affectedCount;
  const averageRisk = nonHoneyItems.length > 0 ? Math.round((totalRiskCount / 4 / nonHoneyItems.length) * 100) : 0;
  const securityTone = averageRisk >= 40 ? "high" : averageRisk >= 20 ? "medium" : "low";
  const securityLabel = securityTone === "high" ? "Riesgo alto" : securityTone === "medium" ? "Riesgo medio" : "Riesgo bajo";
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
    },
    {
      key: "patterns",
      label: "Patrones debiles",
      value: weakPatternReport.affectedCount,
      total: nonHoneyItems.length,
      tone: "warning"
    }
  ];

  return (
    <section className="dashboard-page">
      <header className="page-head dashboard-head">
        <div>
          <h2>Dashboard</h2>
          <p>Resumen general de tu boveda de credenciales.</p>
        </div>
        <div className={`dashboard-score ${securityTone}`}>
          <span>Salud de seguridad</span>
          <strong>{securityLabel}</strong>
          <small>{averageRisk}% de exposicion estimada</small>
        </div>
      </header>

      <div className="stats-grid dashboard-stats-grid">
        <Stat icon={Shield} label="Total guardadas" value={stats.total} hint="Credenciales en boveda" />
        <Stat icon={Sparkles} label="Ultimos 7 dias" value={stats.recent} hint="Nuevas o editadas" tone="positive" />
        <Stat
          icon={KeyRound}
          label="Servicios unicos"
          value={new Set(items.map((i) => i.service)).size}
          hint="Diversificacion de cuentas"
        />
        <Stat
          icon={AlertTriangle}
          label="Comprometidas"
          value={compromised}
          hint="Requieren accion"
          tone={compromised > 0 ? "danger" : "positive"}
        />
      </div>

      <section className="panel audit-panel dashboard-audit-panel">
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
      </section>

      <div className="dashboard-grid">
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

        <section className="panel">
          <h3>Duplicadas (grupos)</h3>
          {duplicateGroups.length === 0 ? <p className="muted">Sin duplicadas.</p> : null}
          <ul className="security-list">
            {duplicateGroups.slice(0, 5).map((group, idx) => (
              <li key={`dup-${idx}`}>
                <strong>{group.items.length} credenciales comparten password</strong>
                <small>
                  {presentationModeEnabled ? "[PRESENTATION_MODE]" : group.items.map((item) => item.service).join(", ")}
                </small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="audit-details">
        <article className="panel">
          <h4>Antiguas (+180 dias)</h4>
          {oldItems.length === 0 ? <p className="muted">Sin credenciales antiguas.</p> : null}
          <ul className="security-list">
            {oldItems.slice(0, 5).map((item) => (
              <li key={`old-${item.id}`}>
                <strong>{item.service}</strong>
                <small>Ultimo cambio: {new Date(item.updatedAt || item.createdAt).toLocaleDateString("es-ES")}</small>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h4>4.4 Patrones debiles</h4>
          <p className="muted">
            Reutilizacion: {weakPatternReport.reusedCount} | Parecidas: {weakPatternReport.similarCount} | Secuencias:{" "}
            {weakPatternReport.sequenceCount}
          </p>
          {weakPatternReport.affectedEntries.length === 0 ? <p className="muted">Sin patrones debiles detectados.</p> : null}
          <ul className="security-list">
            {weakPatternReport.affectedEntries.slice(0, 8).map((entry) => (
              <li key={`weak-pattern-${entry.id}`}>
                <strong>{entry.service}</strong>
                <small>{entry.reasons.map((reason) => mapReasonLabel(reason)).join(", ")}</small>
              </li>
            ))}
          </ul>
          {weakPatternReport.similarPairs.length > 0 ? (
            <>
              <p className="muted">Top contrasenas parecidas:</p>
              <ul className="security-list">
                {weakPatternReport.similarPairs.slice(0, 5).map((pair, idx) => (
                  <li key={`weak-similar-${idx}`}>
                    <strong>
                      {pair.leftService}
                      {" -> "}
                      {pair.rightService}
                    </strong>
                    <small>Similitud: {Math.round(pair.score * 100)}%</small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      </section>
    </section>
  );
}

function mapReasonLabel(reason) {
  if (reason === "reused") return "reutilizada";
  if (reason === "similar") return "parecida";
  if (reason === "sequence") return "secuencia";
  return reason;
}
