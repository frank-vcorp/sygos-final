import { redirect } from "next/navigation";
import {
  saveSendgridAction,
  sendTestEmailAction,
  verifySendgridAction,
} from "../actions";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { ActionLink, Badge, Button, Card, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSendGridSmtpConfig } from "@/lib/sendgrid";
import { requireCompany } from "@/lib/session";
import { getWhatsAppFullStatus } from "@/lib/whatsapp";

export default async function ConfiguracionIntegracionesPage() {
  const session = await requireCompany();
  if (!can(session.role, "config.integrations")) {
    redirect("/inicio");
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  const sendgrid = await getSendGridSmtpConfig(company.id, company.name);
  const whatsapp = await getWhatsAppFullStatus(company.id);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Integraciones · WhatsApp y SendGrid SMTP"
        subtitle={`Configuración de canales de comunicación para ${company.name}. Exclusivo para CEO y Administrador.`}
        back={{ href: "/configuracion", label: "Configuración general" }}
        action={
          <ActionLink href="/configuracion" tone="ghost">
            Ver toda la configuración
          </ActionLink>
        }
      />

      <Card id="sendgrid" className="scroll-mt-28 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="border-l-[3px] border-[#0e5696] pl-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                SendGrid · SMTP Relay
              </h2>
              <Badge tone={!sendgrid.enabled ? "neutral" : sendgrid.hasSecret ? "ok" : "warn"}>
                {!sendgrid.enabled
                  ? "Deshabilitado"
                  : sendgrid.hasSecret
                    ? `Habilitado · Llave ${sendgrid.secretHint ?? "guardada"}`
                    : "Sin llave configurada"}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Configuración de servidor SMTP Relay para envío de cotizaciones, notificaciones y correos del sistema.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <form action={saveSendgridAction} className="space-y-4">
            <input type="hidden" name="returnTo" value="/configuracion/integraciones#sendgrid" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado del servicio">
                <select
                  name="enabled"
                  defaultValue={sendgrid.enabled ? "si" : "no"}
                  className={controlClass}
                >
                  <option value="si">Habilitado</option>
                  <option value="no">Deshabilitado</option>
                </select>
              </Field>

              <Field label="Servidor (Server)" hint="Por defecto: smtp.sendgrid.net">
                <input
                  name="host"
                  defaultValue={sendgrid.host}
                  placeholder="smtp.sendgrid.net"
                  className={controlClass}
                />
              </Field>

              <Field label="Puerto (Port)" hint="587 (TLS recomendado), 465 (SSL) o 25 (sin cifrado/TLS).">
                <select name="port" defaultValue={String(sendgrid.port)} className={controlClass}>
                  <option value="587">587 (TLS — Recomendado)</option>
                  <option value="465">465 (SSL)</option>
                  <option value="25">25 (Unencrypted / TLS)</option>
                </select>
              </Field>

              <Field label="Usuario (Username)" hint="En SendGrid SMTP Relay el usuario es apikey.">
                <input
                  name="username"
                  defaultValue={sendgrid.username}
                  placeholder="apikey"
                  className={controlClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  label="Contraseña / API Key (Password)"
                  hint={
                    sendgrid.secretHint
                      ? `Llave actual: ${sendgrid.secretHint}. Déjalo en blanco si no deseas cambiarla.`
                      : "Ingresa tu API Key de SendGrid (YOUR_API_KEY, inicia con SG.)."
                  }
                >
                  <input
                    name="secret"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      sendgrid.secretHint
                        ? `Llave guardada (${sendgrid.secretHint}) — escribe para reemplazar`
                        : "SG.xxxx… (YOUR_API_KEY)"
                    }
                    className={controlClass}
                  />
                </Field>
              </div>

              <Field label="Correo remitente" hint="Debe ser un remitente o dominio verificado en SendGrid.">
                <input
                  name="fromEmail"
                  type="email"
                  defaultValue={sendgrid.fromEmail}
                  placeholder="notificaciones@tudominio.com"
                  className={controlClass}
                />
              </Field>

              <Field label="Nombre remitente" hint="Nombre visible en la bandeja del destinatario.">
                <input
                  name="fromName"
                  defaultValue={sendgrid.fromName || company.name}
                  placeholder={company.name}
                  className={controlClass}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4">
              <Button type="submit">Guardar SendGrid SMTP</Button>
              <Button type="submit" formAction={verifySendgridAction} tone="ghost">
                Verificar conexión SMTP
              </Button>
            </div>
          </form>

          <form
            action={sendTestEmailAction}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 md:p-5 space-y-4"
          >
            <input type="hidden" name="returnTo" value="/configuracion/integraciones#sendgrid" />
            <div className="space-y-4">
              <header className="border-l-[3px] border-[#0e5696] pl-3">
                <h3 className="text-sm font-bold text-slate-900">Enviar correo de prueba</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Envía un mensaje de prueba real utilizando la configuración guardada de SendGrid SMTP Relay ({sendgrid.host}:{sendgrid.port}).
                </p>
              </header>

              <Field label="Correo destinatario de prueba">
                <input
                  name="toEmail"
                  type="email"
                  required
                  defaultValue={company.email ?? ""}
                  placeholder="destinatario@ejemplo.com"
                  className={controlClass}
                />
              </Field>

              <Field label="Asunto del correo">
                <input
                  name="testSubject"
                  defaultValue={`Correo de prueba SMTP · ${company.name} (SYGOS 3.0)`}
                  className={controlClass}
                />
              </Field>
            </div>

            <div className="flex justify-end border-t border-slate-200/80 pt-3">
              <Button type="submit" tone="ghost">
                Enviar correo de prueba
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <WhatsAppPanel initialState={whatsapp} companyName={company.name} />
    </div>
  );
}
