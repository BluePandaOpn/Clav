import React from "react";

export default function AccountPage({ security, offlineMode, pendingSyncCount, items }) {
  const hardware = security?.hardwareState || {};

  return (
    <section>
      <header className="page-head">
        <h2>Cuenta</h2>
        <p>Estado de sesion, seguridad local y sincronizacion.</p>
      </header>

      <div className="settings-grid">
        <article className="panel">
          <h3>Perfil</h3>
          <p className="muted">Usuario: Local User</p>
          <p className="muted">Vault items: {items?.length || 0}</p>
        </article>

        <article className="panel">
          <h3>Sincronizacion</h3>
          <p className="muted">Estado: {offlineMode ? "OFFLINE" : "online"}</p>
          <p className="muted">Pendientes: {pendingSyncCount || 0}</p>
        </article>

        <article className="panel">
          <h3>Hardware</h3>
          <p className="muted">WebAuthn: {hardware.supportsWebAuthn ? "compatible" : "no disponible"}</p>
          <p className="muted">NFC: {hardware.supportsNfc ? "compatible" : "no disponible"}</p>
          <p className="muted">Credenciales hardware: {hardware.webauthnCredentials?.length || 0}</p>
        </article>
      </div>
    </section>
  );
}
