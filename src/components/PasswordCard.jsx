import React, { useState } from "react";
import { AlertTriangle, Copy, Eye, EyeOff, Trash2 } from "lucide-react";

export default function PasswordCard({ item, onDelete, onCopy, onReveal, travelModeActive = false }) {
  const [show, setShow] = useState(false);
  const created = new Date(item.createdAt).toLocaleDateString("es-ES");
  const breached = Boolean(item?.breachStatus?.compromised);
  const travelLocked = Boolean(travelModeActive && item.isSensitive);

  const toggleReveal = () => {
    if (travelLocked) {
      onReveal?.(item);
      return;
    }

    const next = !show;
    setShow(next);
    if (next) {
      onReveal?.(item);
    }
  };

  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h3>{item.service}</h3>
          <p>{item.username || "Sin usuario"}</p>
        </div>
        <div className="inline-actions">
          {item.isHoney ? (
            <span className="badge honey-badge">
              <AlertTriangle size={12} /> Honey
            </span>
          ) : null}
          {item.isSensitive ? <span className="badge sensitive-badge">Sensitive</span> : null}
          {breached ? <span className="badge breach-badge">Breached</span> : null}
          <span className="badge">{item.category}</span>
        </div>
      </div>

      <div className="password-row">
        <code>{travelLocked ? "[TRAVEL_MODE_LOCKED]" : show ? item.password : "****************"}</code>
        <button className="icon-btn" onClick={toggleReveal} type="button" title={travelLocked ? "Modo viaje activo" : ""}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {item.notes ? <p className="notes">{item.notes}</p> : null}
      {breached ? (
        <p className="notes error-text">
          Detectada en filtraciones ({item.breachStatus.pwnedCount || 0} coincidencias HIBP).
        </p>
      ) : null}
      {travelLocked ? <p className="notes muted">Oculta temporalmente por modo viaje.</p> : null}

      <div className="card-foot">
        <small>Creado: {created}</small>
        <div className="card-actions">
          <button className="icon-btn" onClick={() => onCopy(item)} type="button">
            <Copy size={16} />
          </button>
          <button className="icon-btn danger" onClick={() => onDelete(item.id)} type="button">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
