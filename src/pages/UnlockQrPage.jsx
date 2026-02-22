import React, { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../utils/api.js";

export default function UnlockQrPage({ pushToast }) {
  const [deviceLabel, setDeviceLabel] = useState("mobile-scanner");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Escanea el QR y confirma para autorizar dispositivo.");

  const params = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      cid: search.get("cid") || "",
      code: search.get("code") || "",
      exp: search.get("exp") || "",
      sig: search.get("sig") || "",
      tok: search.get("tok") || ""
    };
  }, []);

  const approve = async () => {
    if (!params.cid || !params.code || !params.exp || !params.sig || !params.tok) {
      setStatus("error");
      setMessage("URL invalida o incompleta.");
      return;
    }
    setStatus("loading");
    try {
      await api.approveQr({
        ...params,
        exp: Number(params.exp),
        token: params.tok,
        deviceLabel
      });
      setStatus("ok");
      setMessage("Dispositivo autorizado correctamente.");
      pushToast("Desbloqueo por QR aprobado", "success");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
      pushToast(error.message, "error");
    }
  };

  return (
    <main className="gate-root">
      <section className="gate-card">
        <div className="gate-head">
          <ShieldCheck size={24} />
          <h1>Autorizacion QR segura</h1>
          <p>{message}</p>
        </div>
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            approve();
          }}
        >
          <label>
            Nombre de dispositivo
            <input value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />
          </label>
          <button className="primary-btn" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Verificando..." : "Autorizar dispositivo"}
          </button>
        </form>
      </section>
    </main>
  );
}
