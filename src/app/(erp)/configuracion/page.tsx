import { redirect } from "next/navigation";
import { toggleInventoryAction, updateCompanyAction } from "./actions";
import { RegimenSelect } from "@/components/regimen-select";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ConfiguracionPage() {
  const session = await requireCompany();
  if (!can(session.role, "config.company")) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  return (
    <>
      <PageHeader
        title="Empresa"
        subtitle={`Datos generales de ${company.name}. Solo el Administrador.`}
      />
      <FormPanel id="identidad" action={updateCompanyAction} className="max-w-3xl">
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
              <textarea name="fiscalAddress" defaultValue={company.fiscalAddress ?? ""} rows={2} className={controlClass} />
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
    </>
  );
}
