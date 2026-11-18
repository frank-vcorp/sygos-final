import { redirect } from "next/navigation";
import { FacturapiSettingsCard } from "@/components/facturapi-settings-card";
import { readIntegrationNotice, SendGridSettingsCard } from "@/components/sendgrid-settings-card";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { Alert, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { loadFacturapiCompanySettings } from "@/lib/fiscal-config";
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
  const [sendgrid, whatsapp, facturapi] = await Promise.all([
    getSendGridSmtpConfig(company.id, company.name),
    getWhatsAppFullStatus(company.id),
    loadFacturapiCompanySettings(company.id),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Integraciones y Facturación"
        subtitle={`Facturapi (CFDI 4.0), correo SMTP y WhatsApp de ${company.name}. Solo el Administrador.`}
      />
      {notice ? <Alert tone={notice.tone} message={notice.message} /> : null}
      <FacturapiSettingsCard
        companyName={company.name}
        companyCode={company.code}
        config={facturapi.config}
        testSlot={facturapi.test}
        liveSlot={facturapi.live}
        registroPatronal={company.registroPatronal}
        employerCurp={company.employerCurp}
        employerState={company.employerState}
      />
      <SendGridSettingsCard
        companyName={company.name}
        companyEmail={company.email}
        sendgrid={sendgrid}
        returnTo="/configuracion/integraciones#sendgrid"
        notice={notice}
      />
      <WhatsAppPanel initialState={whatsapp} companyName={company.name} />
    </div>
  );
}
