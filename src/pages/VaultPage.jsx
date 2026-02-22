import React, { useMemo, useState } from "react";
import { Plus, Search, ShieldAlert } from "lucide-react";
import PasswordCard from "../components/PasswordCard.jsx";
import PasswordStrength from "../components/PasswordStrength.jsx";
import { useLocalStorage } from "../hooks/useLocalStorage.js";

const initialForm = {
  service: "",
  username: "",
  password: "",
  category: "General",
  notes: "",
  isSensitive: false
};

export default function VaultPage({
  items,
  loading,
  error,
  addItem,
  removeItem,
  pushToast,
  generatedPassword,
  generateHoneyPasswords,
  triggerHoneyAccess,
  checkCredentialBreach,
  travelModeActive,
  presentationModeEnabled
}) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useLocalStorage("vault_search", "");
  const [categoryFilter, setCategoryFilter] = useLocalStorage("vault_category_filter", "All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const textMatch =
        !q ||
        item.service.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const categoryMatch = categoryFilter === "All" || item.category === categoryFilter;
      return textMatch && categoryMatch;
    });
  }, [items, search, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category));
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.service || !form.password) {
      pushToast("Servicio y password son obligatorios", "error");
      return;
    }
    try {
      const created = await addItem(form);
      setForm(initialForm);
      if (created?.breachStatus?.compromised) {
        pushToast("ALERTA: credencial guardada pero expuesta en filtraciones", "error");
      } else {
        pushToast("Credencial guardada", "success");
      }
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const onCopy = async (item) => {
    if (presentationModeEnabled) {
      pushToast("Modo presentacion: copy bloqueado", "info");
      return;
    }
    if (travelModeActive && item.isSensitive) {
      pushToast("Modo viaje: copy bloqueado para credenciales sensibles", "info");
      return;
    }
    await navigator.clipboard.writeText(item.password);
    if (item.isHoney) {
      try {
        await triggerHoneyAccess?.(item.id, "copy");
      } catch {
        // No-op to avoid blocking UI.
      }
      pushToast("ALERTA: Honey password accedido (copy)", "error");
      return;
    }
    if (item.breachStatus?.compromised) {
      pushToast("ALERTA: esta password aparece en filtraciones conocidas", "error");
      return;
    }
    pushToast("Password copiado", "success");
  };

  const onReveal = async (item) => {
    if (presentationModeEnabled) {
      pushToast("Modo presentacion: reveal bloqueado", "info");
      return;
    }
    if (travelModeActive && item.isSensitive) {
      pushToast("Modo viaje: reveal bloqueado para credenciales sensibles", "info");
      return;
    }
    if (!item.isHoney) return;
    try {
      await triggerHoneyAccess?.(item.id, "reveal");
    } catch {
      // No-op to avoid blocking UI.
    }
    pushToast("ALERTA: Honey password accedido (reveal)", "error");
  };

  const onDelete = async (id) => {
    try {
      await removeItem(id);
      pushToast("Credencial eliminada", "info");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const checkBreachNow = async (item) => {
    try {
      const updated = await checkCredentialBreach?.(item.id);
      if (updated?.breachStatus?.compromised) {
        pushToast(`Brecha detectada en ${updated.service}`, "error");
      } else {
        pushToast(`Sin brecha detectada en ${item.service}`, "success");
      }
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const generateHoneyBatch = async () => {
    try {
      const created = await generateHoneyPasswords?.(3);
      pushToast(`Honey passwords generadas: ${created?.length || 0}`, "info");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

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
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(form.isSensitive)}
                onChange={(e) => setField("isSensitive", e.target.checked)}
              />
              Marcar como sensible (modo viaje la ocultara)
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
          <div className="filter-row">
            <label>
              Categoria
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <button className="danger-btn" type="button" onClick={generateHoneyBatch}>
              <ShieldAlert size={16} /> Generar honey passwords
            </button>
          </div>

          {loading ? <p className="muted">Cargando...</p> : null}
          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && filtered.length === 0 ? <p className="muted">No hay resultados.</p> : null}
          <div className="card-list">
            {filtered.map((item) => (
              <div key={item.id} className="card-wrap">
                <PasswordCard
                  item={item}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  onReveal={onReveal}
                  travelModeActive={travelModeActive}
                  presentationModeEnabled={presentationModeEnabled}
                />
                <div className="inline-actions">
                  <button className="icon-btn" type="button" onClick={() => checkBreachNow(item)}>
                    Verificar brecha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
