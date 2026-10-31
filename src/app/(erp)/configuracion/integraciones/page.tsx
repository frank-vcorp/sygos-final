import { redirect } from "next/navigation";
import { saveFacturapiAction, verifyFacturapiAction } from "../actions";
import { readIntegrationNotice, SendGridSettingsCard } from "@/components/sendgrid-settings-card";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { Alert, Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSendGridSmtpConfig } from "@/lib/sendgrid";
import { requireCompany } from "@/lib/session";
import { getWhatsAppFullStatus } from "@/lib/whatsapp";

export default async function ConfiguracionIntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ sg?: string; sgm?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "config.integrations")) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  const notice = readIntegrationNotice(await searchParams);
  const sendgrid = await getSendGridSmtpConfig(company.id, company.name);
  const whatsapp = await getWhatsAppFullStatus(company.id);
  const facturapi = await prisma.integrationSetting.findFirst({
    where: { provider: "FACTURAPI", companyId: company.id },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="WhatsApp y correo (SMTP)"
        subtitle={`Canales de ${company.name}. Solo el Administrador.`}
      />
      {notice ? <Alert tone={notice.tone} message={notice.message} /> : null}
      <SendGridSettingsCard
        companyName={company.name}
        companyEmail={company.email}
        sendgrid={sendgrid}
        returnTo="/configuracion/integraciones#sendgrid"
        notice={notice}
      />
      <WhatsAppPanel initialState={whatsapp} companyName={company.name} />
      <FormPanel id="facturapi" action={saveFacturapiAction} className="scroll-mt-28">
        <input type="hidden" name="returnTo" value="/configuracion/integraciones#facturapi" />
        <FormSection
          title={`Facturapi · ${company.name}`}
          description={`${facturapi?.secretHint ? `Llave ${facturapi.secretHint}. ` : "Sin llave guardada. "}El certificado de sello se carga en Facturapi.`}
          columns={2}
        >
          <Field label="Llave secreta">
            <input name="secret" type="password" autoComplete="off" className={controlClass} placeholder="sk_test_… o sk_live_…" />
          </Field>
          <Field label="Registro patronal">
            <input name="registroPatronal" defaultValue={company.registroPatronal ?? ""} className={controlClass} />
          </Field>
          <Field label="CURP del patrón">
            <input name="employerCurp" defaultValue={company.employerCurp ?? ""} className={controlClass} />
          </Field>
          <Field label="Entidad federativa">
            <input name="employerState" defaultValue={company.employerState ?? ""} className={controlClass} placeholder="MEX" />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit" tone="ghost">Guardar Facturapi</Button>
          <Button type="submit" formAction={verifyFacturapiAction} tone="ghost">Verificar llave</Button>
        </FormActions>
      </FormPanel>
    </div>
  );
}
