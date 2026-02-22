import React, { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage.js";

const CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?/|~";

function shuffleChars(source) {
  const arr = source.split("");
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function SecurePasswordInput({
  label = "Password",
  value,
  onChange,
  placeholder = "",
  autoFocus = false,
  toggleKey = "secure_password_virtual_kb"
}) {
  const [useVirtualKeyboard, setUseVirtualKeyboard] = useLocalStorage(toggleKey, false);
  const [layout, setLayout] = useState(() => shuffleChars(CHARSET));

  useEffect(() => {
    if (useVirtualKeyboard) {
      setLayout(shuffleChars(CHARSET));
    }
  }, [useVirtualKeyboard]);

  const visibleValue = useMemo(() => value || "", [value]);

  const appendChar = (char) => {
    onChange(`${visibleValue}${char}`);
    setLayout(shuffleChars(CHARSET));
  };

  const removeLast = () => {
    onChange(visibleValue.slice(0, -1));
    setLayout(shuffleChars(CHARSET));
  };

  const clear = () => {
    onChange("");
    setLayout(shuffleChars(CHARSET));
  };

  return (
    <label className="secure-password-wrap">
      {label}
      <div className="secure-input-row">
        <input
          type="password"
          autoFocus={autoFocus}
          value={visibleValue}
          readOnly={useVirtualKeyboard}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => setUseVirtualKeyboard((prev) => !prev)}
          aria-pressed={Boolean(useVirtualKeyboard)}
        >
          {useVirtualKeyboard ? "Teclado virtual: ON" : "Teclado virtual: OFF"}
        </button>
      </div>
      {useVirtualKeyboard ? (
        <div className="vk-panel" role="group" aria-label="Teclado virtual anti-keylogger">
          <div className="vk-grid">
            {layout.map((char, index) => (
              <button
                key={`${char}-${index}`}
                type="button"
                className="vk-key"
                onClick={() => appendChar(char)}
              >
                {char}
              </button>
            ))}
          </div>
          <div className="vk-actions">
            <button type="button" className="icon-btn" onClick={removeLast}>
              Borrar
            </button>
            <button type="button" className="icon-btn" onClick={clear}>
              Limpiar
            </button>
            <button type="button" className="icon-btn" onClick={() => setLayout(shuffleChars(CHARSET))}>
              Reordenar
            </button>
          </div>
        </div>
      ) : null}
    </label>
  );
}
