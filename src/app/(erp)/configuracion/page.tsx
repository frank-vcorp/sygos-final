import { redirect } from "next/navigation";
import { saveIntegrationAction, toggleInventoryAction, updateCompanyAction, updatePriorityAction } from "./actions";
import { RegimenSelect } from "@/components/regimen-select";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

export default async function ConfiguracionPage() {
  const session = await requireCompany();
  if (!can(session.role, "config.company") && !can(session.role, "config.integrations")) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");
  const integrations = await prisma.integrationSetting.findMany({
    where: { OR: [{ companyId: company.id }, { companyId: null }] },
  });
  const hint = (provider: string, companyScoped: boolean) =>
    integrations.find((item) => item.provider === provider && (companyScoped ? item.companyId === company.id : item.companyId === null));

  return (
    <>
      <PageHeader title="Configuración" subtitle={`Cambios de ${company.name}. No alteran la otra empresa.`} />
      {can(session.role, "config.company") ? (
        <form action={updateCompanyAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Identidad</h2>
          <input type="hidden" name="version" value={company.version} />
          <Field label="Razón social"><input name="legalName" defaultValue={company.legalName ?? ""} className={controlClass} /></Field>
          <Field label="RFC"><input name="rfc" defaultValue={company.rfc ?? ""} className={controlClass} /></Field>
          <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" defaultValue={company.taxRegime} /></Field>
          <Field label="Código postal"><input name="postalCode" defaultValue={company.postalCode ?? ""} className={controlClass} /></Field>
          <Field label="Domicilio fiscal"><textarea name="fiscalAddress" defaultValue={company.fiscalAddress ?? ""} rows={2} className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" defaultValue={company.phone ?? ""} className={controlClass} /></Field>
          <Field label="Correo"><input name="email" defaultValue={company.email ?? ""} className={controlClass} /></Field>
          <Field label="Días de crédito sugeridos"><input name="defaultCreditDays" defaultValue={company.defaultCreditDays ?? ""} className={controlClass} /></Field>
          <Button type="submit">Guardar empresa</Button>
        </form>
      ) : null}

      {can(session.role, "config.company") ? (
        <section className="mt-4 max-w-3xl space-y-3">
          <h2 className="font-medium">Prioridades y SLA</h2>
          <p className="text-sm text-[var(--muted)]">Cada empresa tiene su catálogo. Un cambio no altera atenciones ya creadas ni a la otra empresa.</p>
          {(await prisma.priority.findMany({ where: { companyId: company.id }, orderBy: [{ attentionType: "asc" }, { sortOrder: "asc" }] })).map((priority) => (
            <form key={priority.id} action={updatePriorityAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4 md:grid-cols-6">
              <input type="hidden" name="priorityId" value={priority.id} />
              <p className="text-sm font-medium md:col-span-6">{ATTENTION_LABEL[priority.attentionType as AttentionType] ?? priority.attentionType} · {priority.name}</p>
              <Field label="Precio"><input name="price" defaultValue={priority.price ?? ""} className={controlClass} /></Field>
              <Field label="Incremento %"><input name="incrementPct" defaultValue={priority.incrementPct ?? ""} className={controlClass} /></Field>
              <Field label="Objetivo mín."><input name="targetMinDays" defaultValue={priority.targetMinDays ?? ""} className={controlClass} /></Field>
              <Field label="Objetivo máx."><input name="targetMaxDays" defaultValue={priority.targetMaxDays ?? ""} className={controlClass} /></Field>
              <Field label="SLA máximo"><input name="slaMaxDays" required defaultValue={priority.slaMaxDays} className={controlClass} /></Field>
              <div className="flex items-end"><Button type="submit" tone="ghost">Guardar</Button></div>
            </form>
          ))}
        </section>
      ) : null}

      {session.role === "ADMINISTRADOR" && company.code === "SERVOMOTORES" ? (
        <form action={toggleInventoryAction} className="mt-4 max-w-xl rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Inventario de Servomotores</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {company.inventoryEnabled ? "Habilitado y separado de SYSTRON." : "Deshabilitado. Las operaciones pueden continuar sin existencias."} Habilitarlo no copia el inventario de SYSTRON.
          </p>
          <input type="hidden" name="enabled" value={company.inventoryEnabled ? "no" : "si"} />
          <Button type="submit" tone="ghost" className="mt-3">{company.inventoryEnabled ? "Deshabilitar" : "Habilitar"}</Button>
        </form>
      ) : null}

      {can(session.role, "config.integrations") ? (
        <section className="mt-4 max-w-xl space-y-4">
          <IntegrationForm provider="FACTURAPI" title="Facturapi de esta empresa" setting={hint("FACTURAPI", true)} />
          <IntegrationForm provider="SENDGRID" title="SendGrid" setting={hint("SENDGRID", false)} />
          <IntegrationForm provider="WHATSAPP" title="WhatsApp" setting={hint("WHATSAPP", false)} />
          <p className="text-sm text-[var(--muted)]">Si una credencial falta, la acción que depende de ella se deshabilita. El sistema no simula un timbrado, un correo ni un mensaje exitoso.</p>
        </section>
      ) : null}
    </>
  );
}

function IntegrationForm({
  provider,
  title,
  setting,
}: {
  provider: string;
  title: string;
  setting?: { secretHint: string | null } | null;
}) {
  return (
    <form action={saveIntegrationAction} className="rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{setting?.secretHint ? `Configurada ${setting.secretHint}` : "No configurada."}</p>
      <input type="hidden" name="provider" value={provider} />
      <Field label="Credencial nueva">
        <input name="secret" type="password" autoComplete="off" className={`${controlClass} mt-2`} />
      </Field>
      <Button type="submit" tone="ghost" className="mt-3">Guardar credencial</Button>
    </form>
  );
}
