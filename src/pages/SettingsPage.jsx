import React from "react";
import { Download, Trash } from "lucide-react";

export default function SettingsPage({ clearAll, pushToast, items }) {
  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ credentials: items }, null, 2)], {
      type: "application/json"
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "vault-export.json";
    link.click();
    URL.revokeObjectURL(href);
    pushToast("Export generado", "success");
  };

  const wipeVault = async () => {
    const ok = window.confirm("Esto eliminara todas las credenciales. Deseas continuar?");
    if (!ok) return;
    await clearAll();
    pushToast("Boveda vaciada", "info");
  };

  return (
    <section>
      <header className="page-head">
        <h2>Settings</h2>
        <p>Mantenimiento, respaldo y limpieza de la boveda.</p>
      </header>

      <div className="panel settings-grid">
        <article className="action-card">
          <h3>Exportar boveda</h3>
          <p>Descarga un backup JSON local de tus credenciales.</p>
          <button className="primary-btn" type="button" onClick={exportVault}>
            <Download size={16} /> Exportar
          </button>
        </article>

        <article className="action-card danger-zone">
          <h3>Eliminar todo</h3>
          <p>Borra todas las credenciales guardadas en esta instalacion.</p>
          <button className="danger-btn" type="button" onClick={wipeVault}>
            <Trash size={16} /> Borrar todo
          </button>
        </article>
      </div>
    </section>
  );
}
