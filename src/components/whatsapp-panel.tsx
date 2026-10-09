"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type State = { state: string; qr: string | null; detail: string };

export function WhatsAppPanel() {
  const [status, setStatus] = useState<State>({ state: "desconectado", qr: null, detail: "Baileys vincula el teléfono con un QR. No hay contraseña que capturar." });
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/whatsapp");
    if (response.ok) setStatus(await response.json());
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(action: "link" | "reconnect" | "unlink") {
    setError("");
    const response = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json() as State & { message?: string };
    if (!response.ok) setError(body.message || "No se pudo hablar con WhatsApp.");
    else setStatus(body);
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium">WhatsApp · Baileys</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{status.detail}</p>
      <p className="mt-1 text-sm">Estado: {status.state}</p>
      {status.qr ? <img src={status.qr} alt="Código QR de WhatsApp" className="mt-3 h-56 w-56" /> : null}
      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void act("link")}>Vincular</Button>
        <Button type="button" tone="ghost" onClick={() => void act("reconnect")}>Reconectar</Button>
        <Button type="button" tone="ghost" onClick={() => void act("unlink")}>Volver a vincular</Button>
      </div>
    </Card>
  );
}
