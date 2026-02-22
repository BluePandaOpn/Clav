import React, { useMemo, useState } from "react";
import { Copy, RefreshCw, WandSparkles } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength.jsx";
import { api } from "../utils/api.js";
import { useLocalStorage } from "../hooks/useLocalStorage.js";
import { detectPasswordRequirements } from "../utils/password.js";

export default function GeneratorPage({ setGeneratedPassword, pushToast, presentationModeEnabled }) {
  const [password, setPassword] = useLocalStorage("generator_last_password", "");
  const [options, setOptions] = useLocalStorage("generator_options", {
    length: 16,
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true
  });
  const [siteUrl, setSiteUrl] = useLocalStorage("generator_site_url_v041", "");
  const [policyText, setPolicyText] = useLocalStorage("generator_policy_text_v041", "");
  const [smartMode, setSmartMode] = useState(true);

  const detected = useMemo(
    () =>
      detectPasswordRequirements({
        siteUrl,
        policyText,
        fallbackLength: options.length
      }),
    [siteUrl, policyText, options.length]
  );

  const updateOption = (name, value) => setOptions((prev) => ({ ...prev, [name]: value }));

  const generate = async () => {
    try {
      const effective = smartMode
        ? {
            ...options,
            length: Math.max(options.length, detected.minLength),
            ...detected.allowed
          }
        : options;

      const data = await api.generatePassword(effective);
      setPassword(data.password);
      setGeneratedPassword(data.password);
      pushToast("Password aleatorio generado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const copy = async () => {
    if (presentationModeEnabled) {
      pushToast("Modo presentacion: copy bloqueado", "info");
      return;
    }
    if (!password) return;
    await navigator.clipboard.writeText(password);
    pushToast("Password copiado", "success");
  };

  return (
    <section>
      <header className="page-head">
        <h2>Generator</h2>
        <p>Generador avanzado de passwords usando Node.js crypto.</p>
      </header>

      <div className="panel generator">
        <div className="generated">
          <code>
            {presentationModeEnabled
              ? "[PRESENTATION_MODE]"
              : password || "Haz clic en generar para crear un password seguro"}
          </code>
          <div className="inline-actions">
            <button className="icon-btn" onClick={copy} type="button" disabled={presentationModeEnabled}>
              <Copy size={16} />
            </button>
            <button className="icon-btn" onClick={generate} type="button">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <PasswordStrength value={password} />

        <article className="panel">
          <h3>4.1 Generador inteligente</h3>
          <label>
            Sitio (URL o dominio)
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="ej: login.empresa.com"
            />
          </label>
          <label>
            Requisitos del sitio (texto)
            <textarea
              rows={3}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              placeholder="Ej: minimo 12 caracteres, alfanumerico, al menos una mayuscula y un numero"
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={smartMode} onChange={(e) => setSmartMode(e.target.checked)} />
            Aplicar deteccion automatica
          </label>
          <small className="muted">
            Detectado: min {detected.minLength} | permitidos: {detected.allowedSummary || "sin datos"}
          </small>
        </article>

        <div className="options-grid">
          <label>
            Longitud: {options.length}
            <input
              type="range"
              min="8"
              max="64"
              value={options.length}
              onChange={(e) => updateOption("length", Number(e.target.value))}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.lowercase}
              onChange={(e) => updateOption("lowercase", e.target.checked)}
            />
            minusculas
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.uppercase}
              onChange={(e) => updateOption("uppercase", e.target.checked)}
            />
            mayusculas
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.numbers}
              onChange={(e) => updateOption("numbers", e.target.checked)}
            />
            numeros
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.symbols}
              onChange={(e) => updateOption("symbols", e.target.checked)}
            />
            simbolos
          </label>
        </div>

        <button className="primary-btn" onClick={generate} type="button">
          <WandSparkles size={16} /> Generar password
        </button>
      </div>
    </section>
  );
}
