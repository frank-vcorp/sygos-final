import {
  saveSendgridAction,
  sendTestEmailAction,
  verifySendgridAction,
} from "@/app/(erp)/configuracion/actions";
import { Alert, Badge, Button, Card, controlClass, Field } from "@/components/ui";
import type { SendGridSmtpConfig } from "@/lib/sendgrid";

export function readIntegrationNotice(params: { sg?: string; sgm?: string }): { tone: "ok" | "error"; message: string } | null {
  if ((params.sg === "ok" || params.sg === "error") && params.sgm?.trim()) {
    return { tone: params.sg, message: params.sgm.trim() };
  }
  return null;
}

export function SendGridSettingsCard({
  companyName,
  companyEmail,
  sendgrid,
  returnTo,
  notice,
}: {
  companyName: string;
  companyEmail?: string | null;
  sendgrid: SendGridSmtpConfig;
  returnTo: string;
  notice?: { tone: "ok" | "error"; message: string } | null;
}) {
  return (
    <Card id="sendgrid" className="scroll-mt-28 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="border-l-[3px] border-[#0e5696] pl-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">SendGrid · SMTP Relay</h3>
            <Badge tone={!sendgrid.enabled ? "neutral" : sendgrid.hasSecret ? "ok" : "warn"}>
              {!sendgrid.enabled
                ? "Deshabilitado"
                : sendgrid.hasSecret
                  ? `Habilitado · Llave ${sendgrid.secretHint ?? "guardada"}`
                  : "Sin llave configurada"}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            El correo de prueba usa los datos de este formulario, aunque todavía no los hayas guardado. Si el puerto SMTP está bloqueado, se intenta la API de SendGrid y se muestra la respuesta exacta.
          </p>
        </div>
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone={notice.tone} message={notice.message} />
        </div>
      ) : null}

      <form action={saveSendgridAction} className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado del servicio">
              <select name="enabled" defaultValue={sendgrid.enabled ? "si" : "no"} className={controlClass}>
                <option value="si">Habilitado</option>
                <option value="no">Deshabilitado</option>
              </select>
            </Field>
            <Field label="Servidor (Server)" hint="Por defecto: smtp.sendgrid.net">
              <input name="host" defaultValue={sendgrid.host} placeholder="smtp.sendgrid.net" className={controlClass} />
            </Field>
            <Field label="Puerto (Port)" hint="587 (TLS), 465 (SSL) o 25.">
              <select name="port" defaultValue={String(sendgrid.port)} className={controlClass}>
                <option value="587">587 (TLS — Recomendado)</option>
                <option value="465">465 (SSL)</option>
                <option value="25">25 (Unencrypted / TLS)</option>
              </select>
            </Field>
            <Field label="Usuario (Username)" hint="En SendGrid SMTP Relay el usuario es apikey.">
              <input name="username" defaultValue={sendgrid.username} placeholder="apikey" className={controlClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Contraseña / API Key (Password)"
                hint={
                  sendgrid.secretHint
                    ? `Llave actual: ${sendgrid.secretHint}. Si la dejas en blanco, la prueba usa la llave guardada.`
                    : "Ingresa tu API Key de SendGrid (inicia con SG.)."
                }
              >
                <input
                  name="secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={sendgrid.secretHint ? `Llave guardada (${sendgrid.secretHint})` : "SG.xxxx…"}
                  className={controlClass}
                />
              </Field>
            </div>
            <Field label="Correo remitente" hint="Tiene que ser un Sender Identity verificado en SendGrid.">
              <input name="fromEmail" type="email" defaultValue={sendgrid.fromEmail} placeholder="notificaciones@tudominio.com" className={controlClass} />
            </Field>
            <Field label="Nombre remitente">
              <input name="fromName" defaultValue={sendgrid.fromName || companyName} placeholder={companyName} className={controlClass} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4">
            <Button type="submit">Guardar SendGrid SMTP</Button>
            <Button type="submit" formAction={verifySendgridAction} tone="ghost">Verificar conexión SMTP</Button>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 md:p-5">
          <div className="space-y-4">
            <header className="border-l-[3px] border-[#0e5696] pl-3">
              <h4 className="text-sm font-bold text-slate-900">Enviar correo de prueba</h4>
              <p className="mt-0.5 text-xs text-slate-600">
                Envía con los datos de la izquierda. La prueba se intenta aunque el servicio esté deshabilitado.
              </p>
            </header>
            <Field label="Correo destinatario de prueba">
              <input name="toEmail" type="email" defaultValue={companyEmail ?? ""} placeholder="destinatario@ejemplo.com" className={controlClass} />
            </Field>
            <Field label="Asunto del correo">
              <input name="testSubject" defaultValue={`Correo de prueba SMTP · ${companyName} (SYGOS 3.0)`} className={controlClass} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-slate-200/80 pt-3">
            <Button type="submit" formAction={sendTestEmailAction}>Enviar correo de prueba</Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
