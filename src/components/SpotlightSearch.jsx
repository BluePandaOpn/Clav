import React, { useEffect, useMemo, useRef, useState } from "react";
import { Command, FilePlus2, KeyRound, Pencil, Search } from "lucide-react";
import Modal from "./ui/Modal.jsx";
import Tag from "./ui/Tag.jsx";

const TYPE_FILTERS = [
  { key: "ALL", label: "Todo" },
  { key: "LOGIN", label: "Contrasenas" },
  { key: "CREDIT_CARD", label: "Tarjetas" },
  { key: "SECURE_NOTE", label: "Notas seguras" },
  { key: "API_KEY", label: "API keys" },
  { key: "SSH_KEY", label: "SSH keys" }
];

export default function SpotlightSearch({ open, items, onClose, onOpenCreate, onOpenEdit, onOpenGenerate, onOpenItem }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTypeFilter("ALL");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || [])
      .filter((item) => {
        if (typeFilter !== "ALL" && String(item.entryType || "LOGIN").toUpperCase() !== typeFilter) return false;
        if (!q) return true;
        const text = `${item.service} ${item.username} ${item.category} ${item.notes}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 12);
  }, [items, query, typeFilter]);

  const commandRows = useMemo(() => {
    const rows = [
      { id: "action-create", kind: "action", label: "Crear entrada", action: () => onOpenCreate?.() },
      {
        id: "action-edit",
        kind: "action",
        label: "Editar primer resultado",
        disabled: !filtered[0],
        action: () => {
          if (filtered[0]) onOpenEdit?.(filtered[0]);
        }
      },
      { id: "action-generate", kind: "action", label: "Generar password", action: () => onOpenGenerate?.() }
    ];

    return rows.concat(
      filtered.map((item) => ({
        id: `result-${item.id}`,
        kind: "result",
        item,
        label: item.service,
        action: () => onOpenItem?.(item)
      }))
    );
  }, [filtered, onOpenCreate, onOpenEdit, onOpenGenerate, onOpenItem]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [query, typeFilter, open]);

  const runRow = (index) => {
    const row = commandRows[index];
    if (!row || row.disabled) return;
    row.action();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} overlayClassName="spotlight-overlay" panelClassName="spotlight-panel">
        <header className="spotlight-head">
          <div className="spotlight-input-wrap">
            <Search size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en todo el vault..."
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.min(prev + 1, Math.max(commandRows.length - 1, 0)));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.max(prev - 1, 0));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  runRow(activeIndex);
                }
              }}
            />
          </div>
          <div className="spotlight-filter-row">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`spotlight-chip ${typeFilter === filter.key ? "active" : ""}`}
                onClick={() => setTypeFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        <div className="spotlight-actions">
          <button
            className={`icon-btn ${activeIndex === 0 ? "active" : ""}`}
            type="button"
            onClick={() => runRow(0)}
          >
            <FilePlus2 size={14} /> Crear entrada
          </button>
          <button
            className={`icon-btn ${activeIndex === 1 ? "active" : ""}`}
            type="button"
            onClick={() => runRow(1)}
            disabled={!filtered[0]}
          >
            <Pencil size={14} /> Editar primer resultado
          </button>
          <button
            className={`icon-btn ${activeIndex === 2 ? "active" : ""}`}
            type="button"
            onClick={() => runRow(2)}
          >
            <KeyRound size={14} /> Generar password
          </button>
        </div>

        <ul className="spotlight-results">
          {filtered.length === 0 ? <li className="muted">Sin coincidencias.</li> : null}
          {filtered.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                className={`spotlight-result-btn ${activeIndex === idx + 3 ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(idx + 3)}
                onClick={() => onOpenItem?.(item)}
              >
                <div>
                  <strong>{item.service}</strong>
                  <small>{item.username || "sin usuario"}</small>
                </div>
                <Tag className="badge">{String(item.entryType || "LOGIN").toUpperCase()}</Tag>
              </button>
            </li>
          ))}
        </ul>

        <footer className="spotlight-foot">
          <span className="muted">
            <Command size={12} /> Ctrl/Cmd + K
          </span>
        </footer>
    </Modal>
  );
}
