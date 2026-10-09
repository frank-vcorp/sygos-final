import { redirect } from "next/navigation";
import { commissionAction } from "./actions";
import { ActiveFilters, Badge, Button, controlClass, Empty, Field, FormActions, FormPanel, FormSection, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  PRELIMINAR: "Preliminar",
  PAGADA: "Pagada",
};

export default async function ComisionesPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { vista } = await searchParams;
  const filter = vista === "preliminar" ? "PRELIMINAR" : vista === "pagadas" ? "PAGADA" : null;
  const rows = await prisma.commissionRun.findMany({
    where: { companyId: session.activeCompanyId, ...(filter ? { status: filter } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const vistaLabel = filter === "PRELIMINAR" ? "Preliminar" : filter === "PAGADA" ? "Pagadas" : null;
  return (
    <>
      <PageHeader title="Comisiones" subtitle="Proceso mensual, separado de la nómina. La factura libre no entra." />
      <SegmentedNav
        items={[
          { href: "/comisiones", label: "Todas", active: !filter },
          { href: "/comisiones?vista=preliminar", label: "Preliminar", active: filter === "PRELIMINAR" },
          { href: "/comisiones?vista=pagadas", label: "Pagadas", active: filter === "PAGADA" },
        ]}
      />
      <ActiveFilters items={vistaLabel ? [{ label: vistaLabel, clearHref: "/comisiones" }] : []} />
      <FormPanel action={commissionAction} className="mb-4">
        <FormSection title="Corte mensual" description="Calcula comisiones a partir de la facturación del mes.">
          <Field label="Mes"><input name="month" type="month" required className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Generar preliminar</Button></FormActions>
      </FormPanel>
      {rows.length === 0 ? <Empty title="Sin comisiones" body="El corte conserva la facturación, el porcentaje, el cálculo original y el ajuste." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Mes</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/comisiones/${row.id}`}>{row.month}</RecordLink></Td>
                    <Td><Badge tone={row.status === "PRELIMINAR" ? "warn" : "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => (
            <MobileCard
              key={row.id}
              href={`/comisiones/${row.id}`}
              title={row.month}
              meta={<Badge tone={row.status === "PRELIMINAR" ? "warn" : "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>}
            />
          ))}
        />
      )}
    </>
  );
}
