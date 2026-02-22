import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import PasswordCard from "../components/PasswordCard.jsx";
import PasswordStrength from "../components/PasswordStrength.jsx";

const initialForm = {
  service: "",
  username: "",
  password: "",
  category: "General",
  notes: ""
};

export default function VaultPage({ items, loading, addItem, removeItem, pushToast, generatedPassword }) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.service.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.service || !form.password) {
      pushToast("Servicio y password son obligatorios", "error");
      return;
    }
    try {
      await addItem(form);
      setForm(initialForm);
      pushToast("Credencial guardada", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const onCopy = async (value) => {
    await navigator.clipboard.writeText(value);
    pushToast("Password copiado", "success");
  };

  const onDelete = async (id) => {
    try {
      await removeItem(id);
      pushToast("Credencial eliminada", "info");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  return (
    <section>
      <header className="page-head">
        <h2>Vault</h2>
        <p>Alta, busqueda y gestion de credenciales.</p>
      </header>

      <div className="vault-grid">
        <section className="panel">
          <h3>Nueva credencial</h3>
          <form className="form" onSubmit={onSubmit}>
            <label>
              Servicio
              <input value={form.service} onChange={(e) => setField("service", e.target.value)} />
            </label>
            <label>
              Usuario
              <input value={form.username} onChange={(e) => setField("username", e.target.value)} />
            </label>
            <label>
              Password
              <input
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder={generatedPassword || "Escribe o genera en pagina Generator"}
              />
            </label>
            <PasswordStrength value={form.password} />
            <label>
              Categoria
              <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                <option>General</option>
                <option>Work</option>
                <option>Finance</option>
                <option>Social</option>
              </select>
            </label>
            <label>
              Notas
              <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} />
            </label>
            <button className="primary-btn" type="submit">
              <Plus size={16} /> Guardar
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Buscar por servicio, usuario o categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? <p className="muted">Cargando...</p> : null}
          {!loading && filtered.length === 0 ? <p className="muted">No hay resultados.</p> : null}
          <div className="card-list">
            {filtered.map((item) => (
              <PasswordCard key={item.id} item={item} onDelete={onDelete} onCopy={onCopy} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
