import { redirect } from "next/navigation";
import { saveCommercialGoalsAction } from "../ceo-actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { currentYearMonth, formatYearMonth, monthBounds, parseYearMonth } from "@/lib/ceo-config";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { requireCompany } from "@/lib/session";

export default async function MetasConfigPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  const { mes } = await searchParams;
  const today = currentYearMonth();
  const period = parseYearMonth(mes) ?? today;
  const monthValue = formatYearMonth(period.year, period.month);
  const { start, end } = monthBounds(period.year, period.month);
  const [goals, billed, collected] = await Promise.all([
    prisma.commercialMonthlyGoal.findMany({
      where: { companyId: session.activeCompanyId, year: period.year, month: period.month },
    }),
    prisma.billingDocument.aggregate({
      where: {
        companyId: session.activeCompanyId,
        status: "EMITIDA",
        kind: { in: ["FACTURA", "FACTURA_INTERCOMPANIA"] },
        issuedAt: { gte: start, lt: end },
      },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: {
        companyId: session.activeCompanyId,
        kind: "CLIENTE",
        status: "VALIDADO",
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
  ]);
  const amountOf = (metric: string) => goals.find((goal) => goal.metric === metric)?.amount;

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle={`${session.activeCompanyName} · Solo facturación y cobranza, en pesos y por mes.`}
      />
      <form action="/configuracion/metas" className="mb-4 flex max-w-3xl flex-wrap items-end gap-3">
        <Field label="Mes" className="min-w-48">
          <input type="month" name="mes" required defaultValue={monthValue} className={controlClass} />
        </Field>
        <Button type="submit" tone="ghost">Ver mes</Button>
      </form>
      <FormPanel action={saveCommercialGoalsAction} className="max-w-3xl">
        <input type="hidden" name="month" value={monthValue} />
        <FormSection
          title={`Metas de ${monthValue}`}
          description="Facturación se mide con las facturas emitidas. Cobranza / Pagos se mide con los pagos de cliente validados."
          columns={1}
        >
          <Field label="Facturación" hint={`Medido en el mes: ${money(billed._sum.total ?? 0)}`}>
            <MoneyInput name="FACTURACION" defaultValue={amountOf("FACTURACION") ?? ""} />
          </Field>
          <Field label="Cobranza / Pagos" hint={`Medido en el mes: ${money(collected._sum.amount ?? 0)}`}>
            <MoneyInput name="COBRANZA" defaultValue={amountOf("COBRANZA") ?? ""} />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit">Guardar metas</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
