import React from "react";
import { Copy, RefreshCw, WandSparkles } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength.jsx";
import { api } from "../utils/api.js";
import { useLocalStorage } from "../hooks/useLocalStorage.js";

export default function GeneratorPage({ setGeneratedPassword, pushToast }) {
  const [password, setPassword] = useLocalStorage("generator_last_password", "");
  const [options, setOptions] = useLocalStorage("generator_options", {
    length: 16,
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true
  });

  const updateOption = (name, value) => setOptions((prev) => ({ ...prev, [name]: value }));

  const generate = async () => {
    try {
      const data = await api.generatePassword(options);
      setPassword(data.password);
      setGeneratedPassword(data.password);
      pushToast("Password aleatorio generado", "success");
    } catch (error) {
      pushToast(error.message, "error");
    }
  };

  const copy = async () => {
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
          <code>{password || "Haz clic en generar para crear un password seguro"}</code>
          <div className="inline-actions">
            <button className="icon-btn" onClick={copy} type="button">
              <Copy size={16} />
            </button>
            <button className="icon-btn" onClick={generate} type="button">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <PasswordStrength value={password} />

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
