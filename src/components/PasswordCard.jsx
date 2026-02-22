import { useState } from "react";
import { AlertTriangle, Copy, Eye, EyeOff, Trash2 } from "lucide-react";

export default function PasswordCard({ item, onDelete, onCopy, onReveal }) {
  const [show, setShow] = useState(false);
  const created = new Date(item.createdAt).toLocaleDateString("es-ES");
  const toggleReveal = () => {
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
          <span className="badge">{item.category}</span>
        </div>
      </div>

      <div className="password-row">
        <code>{show ? item.password : "••••••••••••••••"}</code>
        <button className="icon-btn" onClick={toggleReveal} type="button">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {item.notes ? <p className="notes">{item.notes}</p> : null}

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
