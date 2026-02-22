import React, { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function MasterPasswordGate({ isConfigured, onUnlock, onSetup }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isConfigured) {
        await onUnlock(password);
      } else {
        if (password.length < 8) {
          throw new Error("La password maestra debe tener al menos 8 caracteres.");
        }
        if (password !== confirm) {
          throw new Error("Las passwords no coinciden.");
        }
        await onSetup(password);
      }
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="gate-root">
      <section className="gate-card">
        <div className="gate-head">
          {isConfigured ? <LockKeyhole size={24} /> : <ShieldCheck size={24} />}
          <h1>{isConfigured ? "Desbloquear boveda" : "Configurar password maestra"}</h1>
          <p>
            {isConfigured
              ? "Tu cache local esta cifrada. Introduce la password maestra."
              : "La password maestra cifra tu boveda local en el navegador."}
          </p>
        </div>
        <form onSubmit={submit} className="gate-form">
          <label>
            Password maestra
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 8 caracteres"
            />
          </label>
          {!isConfigured ? (
            <label>
              Confirmar password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la password"
              />
            </label>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Procesando..." : isConfigured ? "Desbloquear" : "Crear y desbloquear"}
          </button>
        </form>
      </section>
    </main>
  );
}
