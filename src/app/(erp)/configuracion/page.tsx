import { redirect } from "next/navigation";
import {
  saveFacturapiAction,
  saveSendgridAction,
  sendTestEmailAction,
  toggleInventoryAction,
  updateCompanyAction,
  updatePriorityAction,
  verifyFacturapiAction,
  verifySendgridAction,
} from "./actions";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { RegimenSelect } from "@/components/regimen-select";
import {
  ActionLink,
  Badge,
  Button,
  Card,
  controlClass,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  MoneyInput,
  PageHeader,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { getSendGridSmtpConfig } from "@/lib/sendgrid";
import { requireCompany } from "@/lib/session";
import { getWhatsAppFullStatus } from "@/lib/whatsapp";

export default async function ConfiguracionPage() {
  const session = await requireCompany();
  if (!can(session.role, "config.company") && !can(session.role, "config.integrations")) {
    redirect("/inicio");
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  const integrations = await prisma.integrationSetting.findMany({
    where: { OR: [{ companyId: company.id }, { companyId: null }] },
  });
  const hint = (provider: string, companyScoped: boolean) =>
    integrations.find(
      (item) => item.provider === provider && (companyScoped ? item.companyId === company.id : item.companyId === null),
    );

  const priorities = can(session.role, "config.company")
    ? await prisma.priority.findMany({
        where: { companyId: company.id },
        orderBy: [{ attentionType: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const sendgrid = can(session.role, "config.integrations")
    ? await getSendGridSmtpConfig(company.id, company.name)
    : null;
  const whatsapp = can(session.role, "config.integrations")
    ? await getWhatsAppFullStatus(company.id)
    : null;

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle={`Parámetros e integraciones de ${company.name}. Acceso exclusivo para CEO y Administrador.`}
      />
      <nav
        className="sticky top-14 z-10 mb-5 flex flex-wrap gap-2 overflow-x-auto border-y border-slate-200/80 bg-[var(--bg)] py-2.5 md:top-0"
        aria-label="Secciones de configuración"
      >
        {can(session.role, "config.company") ? (
          <ActionLink href="#identidad" tone="ghost" className="shrink-0">
            Identidad
          </ActionLink>
        ) : null}
        {can(session.role, "config.company") ? (
          <ActionLink href="#prioridades" tone="ghost" className="shrink-0">
            Prioridades y SLA
          </ActionLink>
        ) : null}
        {can(session.role, "config.integrations") ? (
          <>
            <ActionLink href="#integraciones" tone="ghost" className="shrink-0">
              Integraciones
            </ActionLink>
            <ActionLink href="#sendgrid" tone="ghost" className="shrink-0">
              SendGrid SMTP
            </ActionLink>
            <ActionLink href="#whatsapp" tone="ghost" className="shrink-0">
              WhatsApp · Baileys
            </ActionLink>
          </>
        ) : null}
      </nav>

      {can(session.role, "config.company") ? (
        <FormPanel id="identidad" action={updateCompanyAction} className="max-w-3xl scroll-mt-28">
          <input type="hidden" name="version" value={company.version} />
          <FormSection
            title="Identidad fiscal y contacto"
            description={`Datos de ${company.name} para facturación y comunicación.`}
          >
            <Field label="Razón social">
              <input name="legalName" defaultValue={company.legalName ?? ""} className={controlClass} />
            </Field>
            <Field label="RFC">
              <input name="rfc" defaultValue={company.rfc ?? ""} className={controlClass} />
            </Field>
            <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT.">
              <RegimenSelect name="taxRegime" defaultValue={company.taxRegime} />
            </Field>
            <Field label="Código postal">
              <input name="postalCode" defaultValue={company.postalCode ?? ""} className={controlClass} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Domicilio fiscal">
                <textarea
                  name="fiscalAddress"
                  defaultValue={company.fiscalAddress ?? ""}
                  rows={2}
                  className={controlClass}
                />
              </Field>
            </div>
            <Field label="Teléfono">
              <input name="phone" defaultValue={company.phone ?? ""} className={controlClass} />
            </Field>
            <Field label="Correo">
              <input name="email" defaultValue={company.email ?? ""} className={controlClass} />
            </Field>
            <Field label="Días de crédito sugeridos">
              <input name="defaultCreditDays" defaultValue={company.defaultCreditDays ?? ""} className={controlClass} />
            </Field>
          </FormSection>
          <FormActions>
            <Button type="submit">Guardar empresa</Button>
          </FormActions>
        </FormPanel>
      ) : null}

      {can(session.role, "config.company") ? (
        <section id="prioridades" className="mt-8 max-w-5xl scroll-mt-28 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Prioridades y SLA</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cada empresa tiene su catálogo. Un cambio no altera atenciones ya creadas ni a la otra empresa.
            </p>
          </div>
          {priorities.map((priority) => (
            <FormPanel key={priority.id} action={updatePriorityAction}>
              <input type="hidden" name="priorityId" value={priority.id} />
              <FormSection
                title={`${ATTENTION_LABEL[priority.attentionType as AttentionType] ?? priority.attentionType} · ${priority.name}`}
                description="Precio, objetivos de entrega y SLA máximo para nuevas atenciones."
              >
                <Field label="Precio">
                  <MoneyInput name="price" defaultValue={priority.price ?? ""} />
                </Field>
                <Field label="Incremento %">
                  <input name="incrementPct" defaultValue={priority.incrementPct ?? ""} className={controlClass} />
                </Field>
                <Field label="Objetivo mín.">
                  <input name="targetMinDays" defaultValue={priority.targetMinDays ?? ""} className={controlClass} />
                </Field>
                <Field label="Objetivo máx.">
                  <input name="targetMaxDays" defaultValue={priority.targetMaxDays ?? ""} className={controlClass} />
                </Field>
                <Field label="SLA máximo">
                  <input name="slaMaxDays" required defaultValue={priority.slaMaxDays} className={controlClass} />
                </Field>
              </FormSection>
              <FormActions>
                <Button type="submit" tone="ghost">
                  Guardar prioridad
                </Button>
              </FormActions>
            </FormPanel>
          ))}
        </section>
      ) : null}

      {session.role === "ADMINISTRADOR" && company.code === "SERVOMOTORES" ? (
        <FormPanel action={toggleInventoryAction} className="mt-6 max-w-xl">
          <FormSection
            title="Inventario de Servomotores"
            description="Habilitarlo no copia el inventario de SYSTRON. Las operaciones pueden continuar sin existencias si está deshabilitado."
            columns={1}
          >
            <p className="text-sm text-slate-500">
              {company.inventoryEnabled ? "Habilitado y separado de SYSTRON." : "Deshabilitado en este momento."}
            </p>
            <input type="hidden" name="enabled" value={company.inventoryEnabled ? "no" : "si"} />
          </FormSection>
          <FormActions>
            <Button type="submit" tone="ghost">
              {company.inventoryEnabled ? "Deshabilitar inventario" : "Habilitar inventario"}
            </Button>
          </FormActions>
        </FormPanel>
      ) : null}

      {can(session.role, "config.integrations") && sendgrid && whatsapp ? (
        <section id="integraciones" className="mt-8 max-w-5xl scroll-mt-28 space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Integraciones de Comunicación y Facturación
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configura SendGrid SMTP Relay, WhatsApp (Baileys) con vinculación QR y Facturapi directamente desde la interfaz.
            </p>
          </div>

          {/* 1. SendGrid SMTP Relay */}
          <Card id="sendgrid" className="scroll-mt-28 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="border-l-[3px] border-[#0e5696] pl-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">
                    SendGrid · SMTP Relay
                  </h3>
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
                <input type="hidden" name="returnTo" value="/configuracion#sendgrid" />
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
                <input type="hidden" name="returnTo" value="/configuracion#sendgrid" />
                <div className="space-y-4">
                  <header className="border-l-[3px] border-[#0e5696] pl-3">
                    <h4 className="text-sm font-bold text-slate-900">Enviar correo de prueba</h4>
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

          {/* 2. WhatsApp via Baileys */}
          <WhatsAppPanel initialState={whatsapp} companyName={company.name} />

          {/* 3. Facturapi */}
          <FormPanel id="facturapi" action={saveFacturapiAction} className="scroll-mt-28">
            <input type="hidden" name="returnTo" value="/configuracion#facturapi" />
            <FormSection
              title={`Facturapi · ${company.name}`}
              description={`${hint("FACTURAPI", true)?.secretHint ? `Llave ${hint("FACTURAPI", true)?.secretHint}. ` : "Sin llave guardada. "}El certificado de sello se carga en Facturapi.`}
              columns={2}
            >
              <Field label="Llave secreta">
                <input
                  name="secret"
                  type="password"
                  autoComplete="off"
                  className={controlClass}
                  placeholder="sk_test_… o sk_live_…"
                />
              </Field>
              <Field label="Registro patronal">
                <input
                  name="registroPatronal"
                  defaultValue={company.registroPatronal ?? ""}
                  className={controlClass}
                />
              </Field>
              <Field label="CURP del patrón">
                <input
                  name="employerCurp"
                  defaultValue={company.employerCurp ?? ""}
                  className={controlClass}
                />
              </Field>
              <Field label="Entidad federativa">
                <input
                  name="employerState"
                  defaultValue={company.employerState ?? ""}
                  className={controlClass}
                  placeholder="MEX"
                />
              </Field>
            </FormSection>
            <FormActions>
              <Button type="submit" tone="ghost">
                Guardar Facturapi
              </Button>
              <Button type="submit" formAction={verifyFacturapiAction} tone="ghost">
                Verificar llave
              </Button>
            </FormActions>
          </FormPanel>
        </section>
      ) : null}
    </>
  );
}
