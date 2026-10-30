import { redirect } from "next/navigation";
import {
  saveFacturapiAction,
  toggleInventoryAction,
  updateCompanyAction,
  updatePriorityAction,
  verifyFacturapiAction,
} from "./actions";
import { readIntegrationNotice, SendGridSettingsCard } from "@/components/sendgrid-settings-card";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { RegimenSelect } from "@/components/regimen-select";
import {
  ActionLink,
  Alert,
  Button,
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

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ sg?: string; sgm?: string }>;
}) {
  const notice = readIntegrationNotice(await searchParams);
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
      {notice ? <Alert tone={notice.tone} message={notice.message} /> : null}
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

          <SendGridSettingsCard
            companyName={company.name}
            companyEmail={company.email}
            sendgrid={sendgrid}
            returnTo="/configuracion#sendgrid"
            notice={notice}
          />

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
