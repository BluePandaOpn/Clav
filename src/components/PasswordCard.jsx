import React, { useState } from "react";
import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";

export default function PasswordCard({ item, onDelete, onCopy }) {
  const [show, setShow] = useState(false);
  const created = new Date(item.createdAt).toLocaleDateString("es-ES");

  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h3>{item.service}</h3>
          <p>{item.username || "Sin usuario"}</p>
        </div>
        <span className="badge">{item.category}</span>
      </div>

      <div className="password-row">
        <code>{show ? item.password : "••••••••••••••••"}</code>
        <button className="icon-btn" onClick={() => setShow((prev) => !prev)} type="button">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {item.notes ? <p className="notes">{item.notes}</p> : null}

      <div className="card-foot">
        <small>Creado: {created}</small>
        <div className="card-actions">
          <button className="icon-btn" onClick={() => onCopy(item.password)} type="button">
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
