import React from "react";

export default function Modal({ open, onClose, overlayClassName = "", panelClassName = "", children }) {
  if (!open) return null;

  const overlayClasses = ["ui-modal-overlay", overlayClassName].filter(Boolean).join(" ");
  const panelClasses = ["ui-modal-panel", panelClassName].filter(Boolean).join(" ");

  return (
    <div className={overlayClasses} onClick={onClose}>
      <section className={panelClasses} onClick={(event) => event.stopPropagation()}>
        {children}
      </section>
    </div>
  );
}
