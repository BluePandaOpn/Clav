import React, { useEffect, useState } from "react";
import { Copy, Download, KeyRound, Lock, SearchCheck, Shield, Smartphone, Trash, Usb } from "lucide-react";
import { api } from "../utils/api.js";

export default function SettingsPage({
  clearAll,
  pushToast,
  items,
  security,
  addItem,
  scanCredentialBreaches,
  updateRotationPolicy,
  rotateCredentialNow,
  rotateDueNow,
  listRotationDue,
  autoLockEnabled,
  setAutoLockEnabled,
  autoLockMinutes,
  setAutoLockMinutes,
  autoLockGraceSeconds,
  setAutoLockGraceSeconds,
  travelModeActive,
  travelModeDurationMinutes,
  setTravelModeDurationMinutes,
  travelModeExpiresAt,
  activateTravelMode,
  deactivateTravelMode,
  presentationModeEnabled,
  activatePresentationMode,
  deactivatePresentationMode
}) {
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
  const [passkeyLabel, setPasskeyLabel] = useState("Passkey principal");
  const [yubiKeyLabel, setYubiKeyLabel] = useState("YubiKey");
  const [nfcToken, setNfcToken] = useState("");
  const [hardwareBusy, setHardwareBusy] = useState(false);
  const [breachBusy, setBreachBusy] = useState(false);
  const [rotationBusy, setRotationBusy] = useState(false);
  const [rotationDueCount, setRotationDueCount] = useState(0);
  const [rotationDuePreview, setRotationDuePreview] = useState([]);
  const [rotationCredentialId, setRotationCredentialId] = useState("");
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [rotationIntervalDays, setRotationIntervalDays] = useState(90);

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
      if (listRotationDue) {
        const rotation = await listRotationDue();
        setRotationDueCount(rotation?.total || 0);
        setRotationDuePreview((rotation?.items || []).slice(0, 6));
      }
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

  const registerPasskey = async () => {
    setHardwareBusy(true);
    try {
      await security.registerHardwareCredential({ label: passkeyLabel, kind: "passkey" });
      pushToast("Passkey registrada", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setHardwareBusy(false);
    }
  };

  const registerYubiKey = async () => {
    setHardwareBusy(true);
    try {
      await security.registerHardwareCredential({ label: yubiKeyLabel, kind: "yubikey" });
      pushToast("YubiKey registrada", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setHardwareBusy(false);
    }
  };

  const testHardwareAuth = async () => {
    setHardwareBusy(true);
    try {
      const auth = await security.authenticateHardwareCredential();
      pushToast(`Autenticacion OK: ${auth.label}`, "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setHardwareBusy(false);
    }
  };

  const saveNfcToken = async () => {
    setHardwareBusy(true);
    try {
      await security.setupNfcUnlockSecret(nfcToken);
      setNfcToken("");
      pushToast("Token NFC guardado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setHardwareBusy(false);
    }
  };

  const testNfcUnlock = async () => {
    setHardwareBusy(true);
    try {
      const ok = await security.verifyNfcUnlock();
      if (!ok) {
        throw new Error("Tag NFC leido, pero token invalido o timeout.");
      }
      pushToast("NFC unlock validado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setHardwareBusy(false);
    }
  };

  const clearNfcToken = () => {
    security.clearNfcUnlockSecret();
    pushToast("Token NFC eliminado", "info");
  };

  const hardwareState = security.hardwareState || {
    supportsWebAuthn: false,
    supportsNfc: false,
    webauthnCredentials: [],
    nfcEnabled: false
  };
  const compromisedCount = items.filter((item) => item?.breachStatus?.compromised).length;

  const runBreachScan = async () => {
    setBreachBusy(true);
    try {
      const result = await scanCredentialBreaches?.();
      pushToast(
        `Scan completado: ${result?.compromised || 0} comprometidas de ${result?.total || items.length}`,
        result?.compromised ? "error" : "success"
      );
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setBreachBusy(false);
    }
  };

  const onAutoLockMinutesChange = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0.25, Math.min(240, parsed));
    setAutoLockMinutes?.(clamped);
  };

  const onAutoLockGraceChange = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(0, Math.min(30, parsed));
    setAutoLockGraceSeconds?.(clamped);
  };

  const onTravelMinutesChange = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(1, Math.min(24 * 60, parsed));
    setTravelModeDurationMinutes?.(clamped);
  };

  const applyRotationPolicyToSelected = async () => {
    if (!rotationCredentialId) {
      pushToast("Selecciona una credencial para configurar rotacion", "error");
      return;
    }
    setRotationBusy(true);
    try {
      const updated = await updateRotationPolicy?.(rotationCredentialId, {
        enabled: Boolean(rotationEnabled),
        intervalDays: Number(rotationIntervalDays || 90)
      });
      if (!updated) throw new Error("No se pudo actualizar la politica de rotacion.");
      await loadSecurityData();
      pushToast("Politica de auto-rotacion actualizada", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setRotationBusy(false);
    }
  };

  const rotateSelectedNow = async () => {
    if (!rotationCredentialId) {
      pushToast("Selecciona una credencial para rotar", "error");
      return;
    }
    setRotationBusy(true);
    try {
      const result = await rotateCredentialNow?.(rotationCredentialId, "settings_manual");
      await loadSecurityData();
      pushToast(`Rotacion aplicada (${result?.rotation?.kind || "N/A"})`, "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setRotationBusy(false);
    }
  };

  const runDueRotation = async () => {
    setRotationBusy(true);
    try {
      const result = await rotateDueNow?.(50);
      await loadSecurityData();
      pushToast(
        `Rotacion vencidas: ${result?.rotated || 0} rotadas, ${result?.failed || 0} fallidas`,
        result?.failed ? "error" : "success"
      );
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setRotationBusy(false);
    }
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
          <h3>4.3 Auto-rotacion de credenciales</h3>
          <p>Rotacion para servicios compatibles: GitHub tokens, API keys y SSH keys.</p>
          <small className="muted">Credenciales vencidas ahora: {rotationDueCount}</small>
          <label>
            Credencial compatible
            <select value={rotationCredentialId} onChange={(e) => setRotationCredentialId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {items
                .filter((item) => item.rotationPolicy?.supported)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.service} ({item.rotationPolicy?.kind})
                  </option>
                ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={rotationEnabled} onChange={(e) => setRotationEnabled(e.target.checked)} />
            Activar auto-rotacion para esta credencial
          </label>
          <label>
            Intervalo (dias)
            <input
              type="number"
              min="1"
              max="365"
              step="1"
              value={rotationIntervalDays}
              onChange={(e) => setRotationIntervalDays(Number(e.target.value || 90))}
            />
          </label>
          <div className="inline-actions">
            <button className="primary-btn" type="button" onClick={applyRotationPolicyToSelected} disabled={rotationBusy}>
              Guardar politica
            </button>
            <button className="icon-btn" type="button" onClick={rotateSelectedNow} disabled={rotationBusy}>
              Rotar seleccionada
            </button>
          </div>
          <button className="primary-btn" type="button" onClick={runDueRotation} disabled={rotationBusy}>
            {rotationBusy ? "Rotando..." : "Rotar todas las vencidas"}
          </button>
          {rotationDuePreview.length > 0 ? (
            <ul className="security-list">
              {rotationDuePreview.map((item) => (
                <li key={item.id}>
                  <strong>{item.service}</strong>
                  <small>{item.rotationPolicy?.kind || "N/A"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Sin credenciales vencidas para rotacion.</p>
          )}
        </article>

        <article className="action-card">
          <h3>0.2.3 Modo presentacion</h3>
          <p>Oculta datos sensibles temporalmente cuando compartes pantalla.</p>
          <small className="muted">Estado: {presentationModeEnabled ? "ACTIVO" : "inactivo"}</small>
          <div className="inline-actions">
            <button className="primary-btn" type="button" onClick={activatePresentationMode} disabled={presentationModeEnabled}>
              Activar
            </button>
            <button className="icon-btn" type="button" onClick={deactivatePresentationMode} disabled={!presentationModeEnabled}>
              Desactivar
            </button>
          </div>
        </article>

        <article className="action-card">
          <h3>0.2.2 Modo viaje</h3>
          <p>Oculta temporalmente credenciales sensibles mientras viajas.</p>
          <small className="muted">Estado: {travelModeActive ? "ACTIVO" : "inactivo"}</small>
          {travelModeActive && travelModeExpiresAt ? (
            <small className="muted">Expira: {new Date(travelModeExpiresAt).toLocaleString("es-ES")}</small>
          ) : null}
          <label>
            Duracion temporal (minutos)
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              value={travelModeDurationMinutes}
              onChange={(e) => onTravelMinutesChange(e.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button className="primary-btn" type="button" onClick={() => activateTravelMode?.(travelModeDurationMinutes)}>
              Activar modo viaje
            </button>
            <button className="icon-btn" type="button" onClick={deactivateTravelMode} disabled={!travelModeActive}>
              Desactivar
            </button>
          </div>
        </article>

        <article className="action-card">
          <h3>0.1.6 Auto-lock inteligente</h3>
          <p>Bloqueo automatico por inactividad, pestana oculta, perdida de foco y salida del mouse.</p>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(autoLockEnabled)}
              onChange={(e) => setAutoLockEnabled?.(e.target.checked)}
            />
            Activar auto-lock inteligente
          </label>
          <label>
            Minutos de inactividad
            <input
              type="number"
              min="0.25"
              max="240"
              step="0.25"
              value={autoLockMinutes}
              onChange={(e) => onAutoLockMinutesChange(e.target.value)}
              disabled={!autoLockEnabled}
            />
          </label>
          <label>
            Gracia para foco/pestana/mouse (segundos)
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={autoLockGraceSeconds}
              onChange={(e) => onAutoLockGraceChange(e.target.value)}
              disabled={!autoLockEnabled}
            />
          </label>
          <small className="muted">Inactividad: 0.25 a 240 min. Gracia: 0 a 30 seg.</small>
        </article>

        <article className="action-card">
          <h3>0.1.5 Deteccion de brechas</h3>
          <p>Integracion con HIBP + base local de passwords filtradas con alertas automaticas.</p>
          <small className="muted">Comprometidas detectadas: {compromisedCount}</small>
          <button className="primary-btn" type="button" onClick={runBreachScan} disabled={breachBusy}>
            <SearchCheck size={16} /> {breachBusy ? "Escaneando..." : "Escanear boveda ahora"}
          </button>
        </article>

        <article className="action-card">
          <h3>0.1.3 Autenticacion basada en hardware</h3>
          <p>WebAuthn/Passkeys, YubiKey y NFC unlock local experimental.</p>
          <small className="muted">
            WebAuthn: {hardwareState.supportsWebAuthn ? "compatible" : "no disponible"} | NFC:{" "}
            {hardwareState.supportsNfc ? "compatible" : "no disponible"}
          </small>
          <label>
            Passkey label
            <input value={passkeyLabel} onChange={(e) => setPasskeyLabel(e.target.value)} />
          </label>
          <button
            className="primary-btn"
            type="button"
            onClick={registerPasskey}
            disabled={hardwareBusy || !hardwareState.supportsWebAuthn}
          >
            <KeyRound size={16} /> Registrar Passkey
          </button>
          <label>
            YubiKey label
            <input value={yubiKeyLabel} onChange={(e) => setYubiKeyLabel(e.target.value)} />
          </label>
          <button
            className="primary-btn"
            type="button"
            onClick={registerYubiKey}
            disabled={hardwareBusy || !hardwareState.supportsWebAuthn}
          >
            <Usb size={16} /> Registrar YubiKey
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={testHardwareAuth}
            disabled={hardwareBusy || !hardwareState.supportsWebAuthn}
          >
            <Shield size={16} /> Probar autenticacion hardware
          </button>
          <label>
            Token NFC (se guarda hash local)
            <input
              value={nfcToken}
              onChange={(e) => setNfcToken(e.target.value)}
              placeholder="Ejemplo: KVUNLOCK:mi-token-seguro"
            />
          </label>
          <div className="inline-actions">
            <button
              className="primary-btn"
              type="button"
              onClick={saveNfcToken}
              disabled={hardwareBusy}
            >
              <Smartphone size={16} /> Guardar token NFC
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={clearNfcToken}
              disabled={hardwareBusy || !hardwareState.nfcEnabled}
            >
              Limpiar token
            </button>
          </div>
          <button
            className="primary-btn"
            type="button"
            onClick={testNfcUnlock}
            disabled={hardwareBusy || !hardwareState.supportsNfc || !hardwareState.nfcEnabled}
          >
            <Smartphone size={16} /> Probar NFC unlock
          </button>
          {hardwareState.webauthnCredentials.length > 0 ? (
            <ul className="security-list">
              {hardwareState.webauthnCredentials.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.label} ({item.kind})
                  </strong>
                  <small>{new Date(item.createdAt).toLocaleString("es-ES")}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Sin credenciales hardware registradas.</p>
          )}
        </article>

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
