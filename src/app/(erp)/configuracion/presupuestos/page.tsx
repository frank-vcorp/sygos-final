import { redirect } from "next/navigation";
import { savePurchaseBudgetsAction } from "../ceo-actions";
import { Button, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { GENERAL_MONTHLY_BUDGET_DEFAULT, PARTS_MONTHLY_BUDGET_DEFAULT } from "@/lib/ceo-config";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

export default async function PresupuestosCompraPage() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");

  return (
    <>
      <PageHeader
        title="Presupuestos de compra"
        subtitle={`${company.name} · Mismos grupos que Requerimientos y Compras: Refacciones y Generales.`}
      />
      <FormPanel action={savePurchaseBudgetsAction} className="max-w-3xl">
        <FormSection
          title="Presupuesto mensual"
          description="El CEO puede cambiar ambos importes. No hay tope por compra ni presupuesto por categoría de gasto."
          columns={1}
        >
          <Field label="Refacciones" hint="Inicial: $100,000 MXN">
            <MoneyInput name="parts" defaultValue={company.partsMonthlyBudget ?? PARTS_MONTHLY_BUDGET_DEFAULT} />
          </Field>
          <Field label="Generales" hint="Inicial: $5,000 MXN">
            <MoneyInput name="general" defaultValue={company.generalMonthlyBudget ?? GENERAL_MONTHLY_BUDGET_DEFAULT} />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit">Guardar presupuestos</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
