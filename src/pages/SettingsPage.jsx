import { useEffect, useState } from "react";
import { Copy, Download, Lock, Shield, Trash } from "lucide-react";
import { api } from "../utils/api.js";

export default function SettingsPage({ clearAll, pushToast, items, security, addItem }) {
  const [qr, setQr] = useState(null);
  const [qrImage, setQrImage] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("desktop-main");
  const [devices, setDevices] = useState([]);
  const [audit, setAudit] = useState([]);
  const [shareTargets, setShareTargets] = useState([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [selectedTargetDeviceId, setSelectedTargetDeviceId] = useState("");
  const [sharePackageText, setSharePackageText] = useState("");
  const [incomingPackageText, setIncomingPackageText] = useState("");

  useEffect(() => {
    loadSecurityData();
  }, []);

  useEffect(() => {
    if (!qr?.challengeId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const data = await api.getQrChallengeStatus(qr.challengeId);
        if (data.status === "approved") {
          pushToast("QR aprobado: dispositivo registrado", "success");
          setQr((prev) => (prev ? { ...prev, status: "approved" } : prev));
          loadSecurityData();
          window.clearInterval(timer);
        }
        if (data.status === "expired") {
          setQr((prev) => (prev ? { ...prev, status: "expired" } : prev));
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [qr?.challengeId, pushToast]);

  const loadSecurityData = async () => {
    try {
      const [devRes, auditRes, shareRes] = await Promise.all([
        api.listTrustedDevices(),
        api.listAuditLogs(30),
        api.listShareTargets()
      ]);
      setDevices(devRes.items || []);
      setAudit(auditRes.items || []);
      setShareTargets(shareRes.items || []);
    } catch {
      // Silent by design in settings panel.
    }
  };

  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ credentials: items }, null, 2)], {
      type: "application/json"
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "vault-export.json";
    link.click();
    URL.revokeObjectURL(href);
    pushToast("Export generado", "success");
  };

  const wipeVault = async () => {
    const ok = window.confirm("Esto eliminara todas las credenciales. Deseas continuar?");
    if (!ok) return;
    await clearAll();
    pushToast("Boveda vaciada", "info");
  };

  const lockVault = () => {
    security.lock();
    pushToast("Boveda bloqueada", "info");
  };

  const createUnlockQr = async () => {
    try {
      const data = await api.createQrChallenge({ deviceLabel });
      const image = buildQrImageUrl(data.approvalUrl);
      setQr({ ...data, status: "pending" });
      setQrImage(image);
      pushToast("QR seguro generado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const registerDeviceKey = async () => {
    try {
      const pair = await security.ensureDeviceKeyPair();
      await api.registerDeviceKey({
        deviceId: pair.deviceId,
        label: deviceLabel || "device",
        publicKeyPem: pair.publicKeyPem
      });
      await loadSecurityData();
      pushToast("Llave de dispositivo registrada", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const createSharePackage = async () => {
    if (!selectedCredentialId || !selectedTargetDeviceId) {
      pushToast("Selecciona credencial y dispositivo destino", "error");
      return;
    }

    try {
      const data = await api.createCredentialSharePackage({
        credentialId: selectedCredentialId,
        targetDeviceId: selectedTargetDeviceId
      });
      const text = JSON.stringify(data.package, null, 2);
      setSharePackageText(text);
      await navigator.clipboard.writeText(text);
      pushToast("Paquete cifrado generado y copiado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const importSharedPackage = async () => {
    if (!incomingPackageText.trim()) {
      pushToast("Pega un paquete cifrado primero", "error");
      return;
    }

    try {
      const pkg = JSON.parse(incomingPackageText);
      const credential = await security.decryptSharedPackage(pkg);
      await addItem({
        service: credential.service,
        username: credential.username,
        password: credential.password,
        category: credential.category || "General",
        notes: credential.notes || ""
      });
      pushToast(`Credencial importada: ${credential.service}`, "success");
      setIncomingPackageText("");
    } catch (error) {
      pushToast(`No se pudo importar: ${error.message}`, "error");
    }
  };

  const copyQrUrl = async () => {
    if (!qr?.approvalUrl) return;
    await navigator.clipboard.writeText(qr.approvalUrl);
    pushToast("URL QR copiada", "success");
  };

  return (
    <section>
      <header className="page-head">
        <h2>Settings</h2>
        <p>Mantenimiento, respaldo y limpieza de la boveda.</p>
      </header>

      <div className="panel settings-grid">
        <article className="action-card">
          <h3>Exportar boveda</h3>
          <p>Descarga un backup JSON local de tus credenciales.</p>
          <button className="primary-btn" type="button" onClick={exportVault}>
            <Download size={16} /> Exportar
          </button>
        </article>

        <article className="action-card danger-zone">
          <h3>Eliminar todo</h3>
          <p>Borra todas las credenciales guardadas en esta instalacion.</p>
          <button className="danger-btn" type="button" onClick={wipeVault}>
            <Trash size={16} /> Borrar todo
          </button>
        </article>

        <article className="action-card">
          <h3>Bloquear boveda</h3>
          <p>Cierra la sesion local y solicita password maestra nuevamente.</p>
          <button className="primary-btn" type="button" onClick={lockVault}>
            <Lock size={16} /> Bloquear ahora
          </button>
        </article>

        <article className="action-card">
          <h3>QR unlock avanzado</h3>
          <p>Genera un QR temporal de un solo uso para autorizar un dispositivo.</p>
          <label>
            Nombre del dispositivo origen
            <input value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />
          </label>
          <button className="primary-btn" type="button" onClick={createUnlockQr}>
            <Shield size={16} /> Generar QR de autorizacion
          </button>
          {qr ? (
            <div className="qr-box">
              {qrImage ? <img src={qrImage} alt="QR de desbloqueo" /> : null}
              <small>Estado: {qr.status}</small>
              <small>Expira: {new Date(qr.expiresAt).toLocaleString("es-ES")}</small>
              <button className="icon-btn" type="button" onClick={copyQrUrl}>
                <Copy size={16} /> Copiar URL
              </button>
            </div>
          ) : null}
        </article>

        <article className="action-card">
          <h3>Compartir entre dispositivos</h3>
          <p>Registra una llave RSA por dispositivo y genera paquetes cifrados hibridos.</p>
          <button className="primary-btn" type="button" onClick={registerDeviceKey}>
            <Shield size={16} /> Registrar llave de este dispositivo
          </button>
          <label>
            Credencial a compartir
            <select value={selectedCredentialId} onChange={(e) => setSelectedCredentialId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.service} ({item.username || "sin usuario"})
                </option>
              ))}
            </select>
          </label>
          <label>
            Dispositivo destino
            <select value={selectedTargetDeviceId} onChange={(e) => setSelectedTargetDeviceId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {shareTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-btn" type="button" onClick={createSharePackage}>
            <Copy size={16} /> Generar paquete cifrado
          </button>
          {sharePackageText ? (
            <label>
              Ultimo paquete generado
              <textarea rows={5} value={sharePackageText} onChange={(e) => setSharePackageText(e.target.value)} />
            </label>
          ) : null}
          <label>
            Importar paquete recibido
            <textarea
              rows={5}
              placeholder="Pega aqui el JSON de paquete cifrado"
              value={incomingPackageText}
              onChange={(e) => setIncomingPackageText(e.target.value)}
            />
          </label>
          <button className="primary-btn" type="button" onClick={importSharedPackage}>
            <Download size={16} /> Descifrar paquete localmente
          </button>
        </article>
      </div>

      <div className="panel settings-grid security-grid">
        <article className="action-card">
          <h3>Dispositivos autorizados</h3>
          {devices.length === 0 ? <p className="muted">Sin dispositivos registrados.</p> : null}
          <ul className="security-list">
            {devices.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong>
                <small>{new Date(item.createdAt).toLocaleString("es-ES")}</small>
              </li>
            ))}
          </ul>
        </article>

        <article className="action-card">
          <h3>Bitacora de seguridad</h3>
          {audit.length === 0 ? <p className="muted">Sin eventos.</p> : null}
          <ul className="security-list">
            {audit.map((item) => (
              <li key={item.id}>
                <strong>{item.type}</strong>
                <small>{new Date(item.createdAt).toLocaleString("es-ES")}</small>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function buildQrImageUrl(text) {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encoded}`;
}
