"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, controlClass, Field } from "@/components/ui";

type WhatsAppClientState = {
  state: "desconectado" | "esperando" | "vinculado" | "error";
  statusLabel?: string;
  qr: string | null;
  detail: string;
  linkedPhone?: string | null;
  linkedName?: string | null;
  enabled?: boolean;
  defaultCountryCode?: string;
  hasSavedSession?: boolean;
};

type SendFeedback = {
  tone: "ok" | "error";
  message: string;
  fallbackUrl?: string | null;
};

export function WhatsAppPanel({
  initialState,
  companyName,
}: {
  initialState?: Partial<WhatsAppClientState>;
  companyName?: string;
}) {
  const [status, setStatus] = useState<WhatsAppClientState>({
    state: initialState?.state ?? "desconectado",
    statusLabel: initialState?.statusLabel ?? "Desconectado",
    qr: initialState?.qr ?? null,
    detail:
      initialState?.detail ??
      "Sin vincular. Haz clic en «Iniciar vinculación / Generar QR» y escanea el código desde WhatsApp > Dispositivos vinculados.",
    linkedPhone: initialState?.linkedPhone ?? null,
    linkedName: initialState?.linkedName ?? null,
    enabled: initialState?.enabled !== false,
    defaultCountryCode: initialState?.defaultCountryCode ?? "52",
    hasSavedSession: initialState?.hasSavedSession ?? false,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [enabledDraft, setEnabledDraft] = useState(initialState?.enabled !== false ? "si" : "no");
  const [countryCodeDraft, setCountryCodeDraft] = useState(initialState?.defaultCountryCode ?? "52");

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    `Hola, este es un mensaje de prueba enviado desde SYGOS 3.0${companyName ? ` (${companyName})` : ""} vía WhatsApp (Baileys).`,
  );
  const [sendFeedback, setSendFeedback] = useState<SendFeedback | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/whatsapp", { cache: "no-store" });
      if (response.ok) {
        const next = (await response.json()) as WhatsAppClientState;
        setStatus(next);
      }
    } catch {
      // Ignore background poll error
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  async function handleAction(action: "link" | "fresh" | "reconnect" | "unlink") {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "fresh" ? "link" : action,
          fresh: action === "fresh" || (action === "link" && !status.hasSavedSession),
        }),
      });
      const body = (await response.json()) as WhatsAppClientState & { message?: string };
      if (!response.ok) {
        setError(body.message || "No se pudo comunicar con el servicio de WhatsApp.");
      } else {
        setStatus(body);
        if (action === "unlink") {
          setNotice("Sesión de WhatsApp desvinculada correctamente.");
        } else if (body.qr) {
          setNotice("Código QR generado. Escanéalo desde WhatsApp en tu teléfono.");
        }
      }
    } catch {
      setError("Error de red al comunicarse con el servicio de WhatsApp.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy("settings");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          enabled: enabledDraft === "si",
          defaultCountryCode: countryCodeDraft,
        }),
      });
      const body = (await response.json()) as WhatsAppClientState & { message?: string };
      if (!response.ok) {
        setError(body.message || "No se pudo guardar la configuración de WhatsApp.");
      } else {
        setStatus(body);
        setNotice("Configuración de WhatsApp guardada.");
      }
    } catch {
      setError("No se pudo guardar la configuración de WhatsApp.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    setBusy("send");
    setSendFeedback(null);
    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          phone: testPhone,
          text: testMessage,
        }),
      });
      const body = (await response.json()) as WhatsAppClientState & {
        message?: string;
        sendResult?: { ok: boolean; sentViaBaileys: boolean; message: string; fallbackUrl: string | null };
      };
      if (body.state) setStatus(body);
      const res = body.sendResult;
      if (response.ok && res?.ok) {
        setSendFeedback({
          tone: "ok",
          message: res.message,
          fallbackUrl: res.fallbackUrl,
        });
      } else {
        setSendFeedback({
          tone: "error",
          message: res?.message || body.message || "No se pudo enviar el mensaje de prueba.",
          fallbackUrl: res?.fallbackUrl ?? null,
        });
      }
    } catch {
      setSendFeedback({
        tone: "error",
        message: "Error de red al intentar enviar el mensaje de prueba.",
      });
    } finally {
      setBusy(null);
    }
  }

  const badgeTone =
    status.state === "vinculado"
      ? "ok"
      : status.state === "esperando"
        ? "warn"
        : status.state === "error"
          ? "danger"
          : "neutral";

  const badgeText =
    status.state === "vinculado"
      ? "Conectado"
      : status.state === "esperando"
        ? status.qr
          ? "QR listo para escanear"
          : "Esperando escaneo QR"
        : status.state === "error"
          ? "Error de conexión"
          : "Desconectado";

  return (
    <Card id="whatsapp" className="scroll-mt-28 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="border-l-[3px] border-[#0e5696] pl-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              WhatsApp · Baileys
            </h2>
            <Badge tone={badgeTone}>{badgeText}</Badge>
            {status.enabled === false ? (
              <Badge tone="danger">Envío deshabilitado</Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Vinculación directa mediante código QR (sin API de pago ni tokens externos). Envía credenciales de colaboradores, cotizaciones y avisos desde el número de WhatsApp vinculado.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estado de la vinculación
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-800">{status.detail}</p>
            <dl className="mt-3 grid gap-2 border-t border-slate-200/70 pt-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Estado actual</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{badgeText}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Sesión en servidor</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">
                  {status.state === "vinculado" || status.hasSavedSession
                    ? "Guardada (wa-auth)"
                    : "Sin sesión activa"}
                </dd>
              </div>
              {status.linkedPhone ? (
                <div>
                  <dt className="text-slate-400">Número vinculado</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-emerald-700">
                    {status.linkedPhone}
                  </dd>
                </div>
              ) : null}
              {status.linkedName ? (
                <div>
                  <dt className="text-slate-400">Cuenta vinculada</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">
                    {status.linkedName}
                  </dd>
                </div>
              ) : null}
            </dl>

            {error ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {notice}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleAction("fresh")}
              >
                {busy === "fresh" || busy === "link"
                  ? "Generando QR…"
                  : "Iniciar vinculación / Generar QR"}
              </Button>
              <Button
                type="button"
                tone="ghost"
                disabled={busy !== null}
                onClick={() => void handleAction("reconnect")}
              >
                {busy === "reconnect" ? "Reconectando…" : "Reconectar"}
              </Button>
              <Button
                type="button"
                tone="danger"
                disabled={busy !== null}
                onClick={() => void handleAction("unlink")}
              >
                {busy === "unlink" ? "Desvinculando…" : "Cerrar sesión / Desvincular"}
              </Button>
            </div>
          </div>

          {status.qr ? (
            <div className="flex flex-col items-center rounded-xl border-2 border-amber-300/90 bg-amber-50/40 p-5 text-center">
              <p className="text-sm font-bold text-slate-900">
                Escanea este código QR con WhatsApp
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-600">
                En tu teléfono abre <strong>WhatsApp</strong> → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong>.
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <img
                  src={status.qr}
                  alt="Código QR de WhatsApp"
                  className="h-56 w-56 object-contain"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                El código se actualiza automáticamente cada pocos segundos hasta completar el escaneo.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSaveSettings} className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Parámetros de envío WhatsApp</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estado del canal">
                <select
                  value={enabledDraft}
                  onChange={(e) => setEnabledDraft(e.target.value)}
                  className={controlClass}
                >
                  <option value="si">Habilitado</option>
                  <option value="no">Deshabilitado</option>
                </select>
              </Field>
              <Field label="Código de país por defecto" hint="Ej. 52 para números de 10 dígitos en México.">
                <input
                  value={countryCodeDraft}
                  onChange={(e) => setCountryCodeDraft(e.target.value)}
                  placeholder="52"
                  className={controlClass}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" tone="ghost" disabled={busy !== null}>
                {busy === "settings" ? "Guardando…" : "Guardar ajustes WhatsApp"}
              </Button>
            </div>
          </form>
        </div>

        <form
          onSubmit={handleSendTest}
          className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 md:p-5 space-y-4"
        >
          <div className="space-y-4">
            <header className="border-l-[3px] border-[#0e5696] pl-3">
              <h3 className="text-sm font-bold text-slate-900">Enviar WhatsApp de prueba</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Envía un mensaje directo a través de la sesión activa de Baileys para verificar la entrega.
              </p>
            </header>

            <Field
              label="Teléfono destinatario"
              hint="10 dígitos (se antepone código de país) o número completo con lada internacional (ej. 5218112345678)."
            >
              <input
                name="testPhone"
                type="tel"
                required
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Ej. 8112345678 o 5218112345678"
                className={controlClass}
              />
            </Field>

            <Field label="Mensaje de prueba">
              <textarea
                name="testMessage"
                rows={4}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className={controlClass}
              />
            </Field>

            {sendFeedback ? (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  sendFeedback.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                <p>{sendFeedback.message}</p>
                {sendFeedback.tone === "error" && sendFeedback.fallbackUrl ? (
                  <p className="mt-2">
                    <a
                      href={sendFeedback.fallbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Abrir alternativa en WhatsApp Web (wa.me)
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 pt-3">
            <Button type="submit" disabled={busy !== null}>
              {busy === "send" ? "Enviando…" : "Enviar WhatsApp de prueba"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
