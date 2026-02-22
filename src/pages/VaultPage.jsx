import React, { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  FileText,
  KeyRound,
  LockKeyhole,
  Plus,
  Share2,
  Star,
  Table2,
  LayoutGrid
} from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage.js";
import { getStrengthLabel } from "../utils/password.js";
import { api } from "../utils/api.js";
import Card from "../components/ui/Card.jsx";
import ListItem from "../components/ui/ListItem.jsx";
import Tag from "../components/ui/Tag.jsx";
import StrengthMeter from "../components/ui/StrengthMeter.jsx";

const CATEGORY_DEFS = [
  { key: "ALL", label: "Todo" },
  { key: "PASSWORDS", label: "Contrasenas" },
  { key: "CARDS", label: "Tarjetas" },
  { key: "SECURE_NOTES", label: "Notas seguras" },
  { key: "API_KEYS", label: "API Keys" },
  { key: "FAVORITES", label: "Favoritos" },
  { key: "SHARED", label: "Compartidos" }
];

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
  getCredentialHistory,
  travelModeActive,
  presentationModeEnabled
}) {
  const [search, setSearch] = useLocalStorage("vault_search", "");
  const [activeCategory, setActiveCategory] = useLocalStorage("vault_category_v062", "ALL");
  const [viewMode, setViewMode] = useLocalStorage("vault_view_mode_v062", "cards");
  const [favoriteIds, setFavoriteIds] = useLocalStorage("vault_favorites_v062", []);
  const [sharedIds, setSharedIds] = useState(new Set());
  const [shareTargets, setShareTargets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(initialForm);
  const [pendingSpotlightEditId, setPendingSpotlightEditId] = useState("");

  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const [vaults, targets] = await Promise.all([api.listSharedVaults("owner"), api.listShareTargets()]);
        const ids = new Set();
        for (const vault of vaults.items || []) {
          for (const item of vault.items || []) {
            if (item?.id) ids.add(item.id);
          }
        }
        setSharedIds(ids);
        setShareTargets(targets.items || []);
      } catch {
        // Optional for vault UX.
      }
    };
    loadSharedData();
  }, []);

  useEffect(() => {
    const handleSpotlightAction = (event) => {
      const action = event?.detail?.action;
      const itemId = event?.detail?.itemId;

      if (action === "create") {
        setActiveCategory("ALL");
        setSearch("");
        setShowAddForm(true);
        setEditing(false);
        return;
      }

      if ((action === "open" || action === "edit") && itemId) {
        setActiveCategory("ALL");
        setSearch("");
        setShowAddForm(false);
        setSelectedId(itemId);
        if (action === "edit") setPendingSpotlightEditId(itemId);
      }
    };

    window.addEventListener("vault:spotlight-action", handleSpotlightAction);
    return () => window.removeEventListener("vault:spotlight-action", handleSpotlightAction);
  }, [setActiveCategory, setSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (q) {
        const tags = extractTags(item).join(" ").toLowerCase();
        const match =
          item.service.toLowerCase().includes(q) ||
          item.username.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          tags.includes(q);
        if (!match) return false;
      }
      return matchesCategory(item, activeCategory, new Set(favoriteIds), sharedIds);
    });
  }, [items, search, activeCategory, favoriteIds, sharedIds]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedItem = useMemo(() => filtered.find((item) => item.id === selectedId) || null, [filtered, selectedId]);

  const counts = useMemo(() => {
    const favorites = new Set(favoriteIds);
    const map = {};
    for (const def of CATEGORY_DEFS) {
      map[def.key] = (items || []).filter((item) => matchesCategory(item, def.key, favorites, sharedIds)).length;
    }
    return map;
  }, [items, favoriteIds, sharedIds]);

  useEffect(() => {
    if (!selectedItem) return;
    setEditing(false);
    setShowPassword(false);
    setHistory(null);
    setEditForm({
      service: selectedItem.service,
      username: selectedItem.username,
      password: selectedItem.password,
      category: selectedItem.category,
      notes: selectedItem.notes,
      isSensitive: Boolean(selectedItem.isSensitive)
    });
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!pendingSpotlightEditId) return;
    if (!selectedItem || selectedItem.id !== pendingSpotlightEditId) return;
    setEditing(true);
    setPendingSpotlightEditId("");
  }, [pendingSpotlightEditId, selectedItem]);

  const addNewEntry = async (event) => {
    event.preventDefault();
    if (!addForm.service || !addForm.password) {
      pushToast("Servicio y password son obligatorios", "error");
      return;
    }
    try {
      const created = await addItem(addForm);
      setAddForm(initialForm);
      setShowAddForm(false);
      setSelectedId(created?.id || "");
      pushToast("Entrada agregada", "success");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  const saveEdit = async () => {
    if (!selectedItem) return;
    try {
      const payload = {
        service: editForm.service,
        username: editForm.username,
        password: editForm.password,
        category: editForm.category,
        notes: editForm.notes,
        isSensitive: Boolean(editForm.isSensitive)
      };
      await api.updateCredential(selectedItem.id, payload);
      setEditing(false);
      pushToast("Entrada actualizada", "success");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  const copyUsername = async () => {
    if (!selectedItem) return;
    if (presentationModeEnabled) {
      pushToast("Modo presentacion: copy bloqueado", "info");
      return;
    }
    await navigator.clipboard.writeText(selectedItem.username || "");
    pushToast("Usuario copiado", "success");
  };

  const copyPassword = async () => {
    if (!selectedItem) return;
    if (presentationModeEnabled) {
      pushToast("Modo presentacion: copy bloqueado", "info");
      return;
    }
    if (travelModeActive && selectedItem.isSensitive) {
      pushToast("Modo viaje: copy bloqueado para entradas sensibles", "info");
      return;
    }
    await navigator.clipboard.writeText(selectedItem.password || "");
    pushToast("Password copiada", "success");
  };

  const toggleFavorite = (id) => {
    const current = new Set(favoriteIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setFavoriteIds(Array.from(current));
  };

  const loadHistory = async () => {
    if (!selectedItem) return;
    setHistoryLoading(true);
    try {
      const data = await getCredentialHistory?.(selectedItem.id);
      setHistory(data || null);
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const shareSelected = async () => {
    if (!selectedItem) return;
    if (shareTargets.length === 0) {
      pushToast("No hay dispositivos destino para compartir. Registra uno en Settings.", "error");
      return;
    }
    try {
      const target = shareTargets[0];
      const data = await api.createCredentialSharePackage({
        credentialId: selectedItem.id,
        targetDeviceId: target.id
      });
      await navigator.clipboard.writeText(JSON.stringify(data.package, null, 2));
      pushToast(`Paquete compartido copiado (${target.label})`, "success");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  return (
    <section>
      <header className="page-head">
        <h2>Vault</h2>
        <p>Diseno 0.6.2 con categorias, lista central y panel de detalle.</p>
      </header>

      <div className="vault-layout-062">
        <Card as="aside" className="vault-categories">
          <h3>Categorias</h3>
          <ul className="vault-category-list">
            {CATEGORY_DEFS.map((cat) => (
              <ListItem key={cat.key}>
                <button
                  type="button"
                  className={`vault-category-btn ${activeCategory === cat.key ? "active" : ""}`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  <span>{cat.label}</span>
                  <small>{counts[cat.key] || 0}</small>
                </button>
              </ListItem>
            ))}
          </ul>
          <button className="primary-btn vault-add-btn" type="button" onClick={() => setShowAddForm((v) => !v)}>
            <Plus size={14} /> {showAddForm ? "Cerrar alta" : "Nueva entrada"}
          </button>
          {showAddForm ? (
            <form className="form compact-form" onSubmit={addNewEntry}>
              <label>
                Servicio
                <input value={addForm.service} onChange={(e) => setAddForm((p) => ({ ...p, service: e.target.value }))} />
              </label>
              <label>
                Usuario
                <input value={addForm.username} onChange={(e) => setAddForm((p) => ({ ...p, username: e.target.value }))} />
              </label>
              <label>
                Password
                <input
                  value={addForm.password}
                  onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={generatedPassword || "Escribe password"}
                />
              </label>
              <button className="primary-btn" type="submit">
                Guardar
              </button>
            </form>
          ) : null}
        </Card>

        <Card as="section" className="vault-list-panel">
          <div className="vault-list-toolbar">
            <input
              className="vault-inline-search"
              placeholder="Buscar por servicio, usuario o tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="inline-actions">
              <button className={`icon-btn ${viewMode === "cards" ? "active" : ""}`} type="button" onClick={() => setViewMode("cards")}>
                <LayoutGrid size={14} />
              </button>
              <button className={`icon-btn ${viewMode === "table" ? "active" : ""}`} type="button" onClick={() => setViewMode("table")}>
                <Table2 size={14} />
              </button>
            </div>
          </div>

          {loading ? <p className="muted">Cargando...</p> : null}
          {!loading && error ? <p className="error-text">{error}</p> : null}
          {!loading && filtered.length === 0 ? <p className="muted">Sin resultados en esta categoria.</p> : null}

          {viewMode === "cards" ? (
            <div className="vault-entry-list">
              {filtered.map((item) => {
                const meta = getTypeMeta(item.entryType);
                const Icon = meta.icon;
                const strength = getStrengthLabel(item.password || "");
                const strengthTone = strength.toLowerCase();
                const isFavorite = new Set(favoriteIds).has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`entry-row-card ${selectedId === item.id ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                  >
                    <div className="entry-row-main">
                      <div className="entry-icon">
                        <Icon size={15} />
                      </div>
                      <div className="entry-text">
                        <strong>{item.service}</strong>
                        <small>{presentationModeEnabled ? "[PRESENTATION_MODE]" : item.username || "Sin usuario"}</small>
                      </div>
                    </div>
                    <div className="entry-row-side">
                      <span className={`strength-pill ${strengthTone}`}>{strength}</span>
                      <button
                        type="button"
                        className={`icon-btn star-btn ${isFavorite ? "active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                      >
                        <Star size={13} />
                      </button>
                    </div>
                    <div className="entry-tags">
                      {extractTags(item).slice(0, 3).map((tag) => (
                        <Tag key={`${item.id}-${tag}`}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="vault-table-wrap">
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Servicio</th>
                    <th>Usuario</th>
                    <th>Fortaleza</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const meta = getTypeMeta(item.entryType);
                    const Icon = meta.icon;
                    const strength = getStrengthLabel(item.password || "");
                    return (
                      <tr key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
                        <td>
                          <Icon size={14} />
                        </td>
                        <td>{item.service}</td>
                        <td>{presentationModeEnabled ? "[PRESENTATION_MODE]" : item.username || "-"}</td>
                        <td>
                          <span className={`strength-pill ${strength.toLowerCase()}`}>{strength}</span>
                        </td>
                        <td>
                          <div className="table-tags">
                            {extractTags(item).slice(0, 2).map((tag) => (
                              <Tag key={`${item.id}-${tag}`}>
                                {tag}
                              </Tag>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card as="aside" className="vault-detail-panel">
          {!selectedItem ? (
            <p className="muted">Selecciona una entrada para ver detalle.</p>
          ) : (
            <>
              <header className="detail-head">
                <div>
                  <h3>{selectedItem.service}</h3>
                  <p className="muted">{selectedItem.category}</p>
                </div>
                <Tag className="badge">{getTypeMeta(selectedItem.entryType).label}</Tag>
              </header>

              <section className="detail-block">
                <strong>Usuario</strong>
                <code>{presentationModeEnabled ? "[PRESENTATION_MODE]" : selectedItem.username || "-"}</code>
              </section>

              <section className="detail-block">
                <strong>Password</strong>
                <code>
                  {presentationModeEnabled
                    ? "[PRESENTATION_MODE]"
                    : travelModeActive && selectedItem.isSensitive
                      ? "[TRAVEL_MODE_LOCKED]"
                      : showPassword
                        ? selectedItem.password
                        : "****************"}
                </code>
              </section>

              <section className="detail-block">
                <strong>Fortaleza</strong>
                <StrengthMeter value={selectedItem.password || ""} />
              </section>

              <section className="detail-block">
                <strong>Tags</strong>
                <div className="detail-tags">
                  {extractTags(selectedItem).map((tag) => (
                    <Tag key={`${selectedItem.id}-${tag}`}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </section>

              <div className="detail-actions">
                <button className="icon-btn" type="button" onClick={copyUsername}>
                  Copiar usuario
                </button>
                <button className="icon-btn" type="button" onClick={copyPassword}>
                  Copiar contrasena
                </button>
                <button className="icon-btn" type="button" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
                <button className="icon-btn" type="button" onClick={() => setEditing((v) => !v)}>
                  {editing ? "Cancelar" : "Editar"}
                </button>
                <button className="icon-btn" type="button" onClick={loadHistory} disabled={historyLoading}>
                  {historyLoading ? "Cargando..." : "Historial"}
                </button>
                <button className="icon-btn" type="button" onClick={shareSelected}>
                  <Share2 size={13} /> Compartir
                </button>
              </div>

              {editing ? (
                <section className="detail-edit">
                  <label>
                    Servicio
                    <input value={editForm.service || ""} onChange={(e) => setEditForm((p) => ({ ...p, service: e.target.value }))} />
                  </label>
                  <label>
                    Usuario
                    <input value={editForm.username || ""} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} />
                  </label>
                  <label>
                    Password
                    <input value={editForm.password || ""} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} />
                  </label>
                  <label>
                    Categoria
                    <input value={editForm.category || ""} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} />
                  </label>
                  <label>
                    Notas
                    <textarea value={editForm.notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
                  </label>
                  <button className="primary-btn" type="button" onClick={saveEdit}>
                    Guardar cambios
                  </button>
                </section>
              ) : null}

              {history ? (
                <section className="detail-history">
                  <h4>Historial</h4>
                  <ul className="security-list">
                    {(history.changes || []).slice(0, 8).map((entry, index) => (
                      <ListItem key={`history-${selectedItem.id}-${index}`}>
                        <strong>{entry.type}</strong>
                        <small>{new Date(entry.at).toLocaleString("es-ES")}</small>
                        <small>{Array.isArray(entry.fields) ? entry.fields.join(", ") : ""}</small>
                      </ListItem>
                    ))}
                  </ul>
                </section>
              ) : null}

              <button
                className="danger-btn"
                type="button"
                onClick={() => removeItem(selectedItem.id)}
              >
                Eliminar entrada
              </button>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function matchesCategory(item, key, favoriteIds, sharedIds) {
  const type = String(item.entryType || "LOGIN").toUpperCase();
  if (key === "ALL") return true;
  if (key === "PASSWORDS") return type === "LOGIN" || type === "SSH_KEY";
  if (key === "CARDS") return type === "CREDIT_CARD";
  if (key === "SECURE_NOTES") return type === "SECURE_NOTE";
  if (key === "API_KEYS") return type === "API_KEY";
  if (key === "FAVORITES") return favoriteIds.has(item.id);
  if (key === "SHARED") return sharedIds.has(item.id);
  return true;
}

function getTypeMeta(entryType) {
  const type = String(entryType || "LOGIN").toUpperCase();
  if (type === "CREDIT_CARD") return { label: "Tarjeta", icon: CreditCard };
  if (type === "SECURE_NOTE") return { label: "Nota segura", icon: FileText };
  if (type === "API_KEY") return { label: "API Key", icon: KeyRound };
  if (type === "SSH_KEY") return { label: "SSH Key", icon: LockKeyhole };
  return { label: "Contrasena", icon: LockKeyhole };
}

function extractTags(item) {
  const tags = new Set();
  if (item.category) tags.add(item.category);
  tags.add(getTypeMeta(item.entryType).label);
  if (item.isSensitive) tags.add("Sensitive");
  if (item.rotationPolicy?.enabled) tags.add("Auto-rotacion");
  const noteTags = (String(item.notes || "").match(/#[a-z0-9_-]+/gi) || []).map((v) => v.toLowerCase());
  for (const tag of noteTags) tags.add(tag);
  return Array.from(tags);
}
