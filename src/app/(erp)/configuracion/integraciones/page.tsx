import { redirect } from "next/navigation";
import { readIntegrationNotice, SendGridSettingsCard } from "@/components/sendgrid-settings-card";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { ActionLink, Alert, PageHeader } from "@/components/ui";
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
  if (!can(session.role, "config.integrations")) {
    redirect("/inicio");
  }
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  const notice = readIntegrationNotice(await searchParams);
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
      {notice ? <Alert tone={notice.tone} message={notice.message} /> : null}
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
