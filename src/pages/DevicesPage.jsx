import React, { useEffect, useState } from "react";
import { api } from "../utils/api.js";

export default function DevicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await api.listTrustedDevices();
        setItems(data.items || []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <section>
      <header className="page-head">
        <h2>Dispositivos</h2>
        <p>Inventario de dispositivos autorizados y confiables.</p>
      </header>
      <article className="panel">
        {loading ? <p className="muted">Cargando dispositivos...</p> : null}
        {!loading && items.length === 0 ? <p className="muted">Sin dispositivos registrados.</p> : null}
        <ul className="security-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <small>{new Date(item.createdAt).toLocaleString("es-ES")}</small>
              <small>{item.source || "unknown"}</small>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
