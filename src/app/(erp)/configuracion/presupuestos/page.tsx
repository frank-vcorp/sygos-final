import { redirect } from "next/navigation";
import { saveMonthlyAmountsAction } from "../ceo-actions";
import { requireCeoConfig } from "../guard";
import {
  Button,
  controlClass,
  Field,
  FilterBar,
  FormActions,
  FormPanel,
  FormSection,
  MoneyInput,
  PageHeader,
} from "@/components/ui";
import {
  currentYearMonth,
  formatYearMonth,
  GENERAL_MONTHLY_BUDGET_DEFAULT,
  monthBounds,
  PARTS_MONTHLY_BUDGET_DEFAULT,
  parseYearMonth,
} from "@/lib/ceo-config";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export default async function MontosDelMesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const session = await requireCeoConfig();
  const { mes } = await searchParams;
  const today = currentYearMonth();
  const period = parseYearMonth(mes) ?? today;
  const monthValue = formatYearMonth(period.year, period.month);
  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(period.year, period.month - 1, 15)));
  const { start, end } = monthBounds(period.year, period.month);
  const [company, goals, billed, collected] = await Promise.all([
    prisma.company.findUnique({ where: { id: session.activeCompanyId } }),
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
  if (!company) redirect("/empresa");
  const savedGoal = (metric: string) => goals.find((goal) => goal.metric === metric)?.amount;
  const partsAmount = company.partsMonthlyBudget ?? PARTS_MONTHLY_BUDGET_DEFAULT;
  const generalAmount = company.generalMonthlyBudget ?? GENERAL_MONTHLY_BUDGET_DEFAULT;

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Montos del mes"
        subtitle={`${company.name} · Facturación, cobranza y presupuestos de compra.`}
      />
      <FilterBar action="/configuracion/presupuestos">
        <Field label="Mes" className="min-w-48">
          <input type="month" name="mes" required defaultValue={monthValue} className={controlClass} />
        </Field>
        <Button type="submit" tone="ghost">Ver mes</Button>
      </FilterBar>
      <FormPanel action={saveMonthlyAmountsAction} className="max-w-3xl">
        <input type="hidden" name="month" value={monthValue} />
        <FormSection
          title={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          description="Facturación y cobranza son la meta de ese mes. Refacciones y generales son el presupuesto de compra de la empresa: al cambiar de mes se sigue mostrando el importe guardado."
        >
          <Field label="Facturación" hint={`Medido en el mes: ${money(billed._sum.total ?? 0)}`}>
            <MoneyInput name="FACTURACION" defaultValue={savedGoal("FACTURACION") ?? ""} />
          </Field>
          <Field label="Cobranza / Pagos" hint={`Medido en el mes: ${money(collected._sum.amount ?? 0)}`}>
            <MoneyInput name="COBRANZA" defaultValue={savedGoal("COBRANZA") ?? ""} />
          </Field>
          <Field label="Refacciones">
            <MoneyInput name="parts" defaultValue={partsAmount} />
          </Field>
          <Field label="Generales">
            <MoneyInput name="general" defaultValue={generalAmount} />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit">Guardar montos</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
