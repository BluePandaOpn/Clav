import React, { useMemo } from "react";
import { getStrengthScore } from "../utils/password.js";
import { analyzeWeakPatterns } from "../utils/weakPatterns.js";

export default function AuditPage({ items }) {
  const report = useMemo(() => {
    const nonHoney = (items || []).filter((item) => !item.isHoney);
    const weak = nonHoney.filter((item) => getStrengthScore(item.password || "") <= 2);
    const old = nonHoney.filter((item) => {
      const ts = Date.parse(item.updatedAt || item.createdAt || "");
      if (Number.isNaN(ts)) return false;
      return (Date.now() - ts) / (1000 * 60 * 60 * 24) >= 180;
    });
    const patterns = analyzeWeakPatterns(nonHoney);
    return {
      total: nonHoney.length,
      weak,
      old,
      patterns
    };
  }, [items]);

  return (
    <section>
      <header className="page-head">
        <h2>Auditoria</h2>
        <p>Vista dedicada de seguridad del vault.</p>
      </header>

      <div className="settings-grid">
        <article className="panel">
          <h3>Resumen</h3>
          <p className="muted">Debiles: {report.weak.length}</p>
          <p className="muted">Antiguas (+180 dias): {report.old.length}</p>
          <p className="muted">Patrones debiles: {report.patterns.affectedCount}</p>
        </article>

        <article className="panel">
          <h3>Patrones detectados</h3>
          <ul className="security-list">
            {report.patterns.affectedEntries.slice(0, 10).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.service}</strong>
                <small>{entry.reasons.join(", ")}</small>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
