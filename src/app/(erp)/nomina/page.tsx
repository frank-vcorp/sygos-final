import { redirect } from "next/navigation";
import { aguinaldoAction, payrollAction } from "./actions";
import { ActiveFilters, Badge, Button, controlClass, Empty, Field, FormActions, FormPanel, FormSection, MobileCard, PageHeader, RecordLink, ResponsiveData, SegmentedNav, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NominaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const { vista } = await searchParams;
  const rows = await prisma.payrollPeriod.findMany({
    where: { companyId: session.activeCompanyId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const displayed =
    vista === "actual"
      ? rows.filter((row) => row.status === "PRELIMINAR").slice(0, 1)
      : vista === "incidencias"
        ? rows.filter((row) => row.lines.some((line) => line.missing))
        : vista === "documentos"
          ? rows.filter((row) => row.status !== "PRELIMINAR")
          : vista === "aguinaldo"
            ? rows.filter((row) => row.kind === "AGUINALDO")
            : vista === "extraordinarios"
              ? rows.filter((row) => row.kind !== "SEMANAL" && row.kind !== "AGUINALDO")
              : rows;
  const vistaLabels: Record<string, string> = {
    actual: "Periodo actual",
    incidencias: "Incidencias",
    documentos: "Documentos",
    extraordinarios: "Extraordinarios",
    aguinaldo: "Aguinaldo",
  };
  const tabs = [
    { href: "/nomina", label: "Todas", active: !vista },
    { href: "/nomina?vista=actual", label: "Periodo actual", active: vista === "actual" },
    { href: "/nomina?vista=incidencias", label: "Incidencias", active: vista === "incidencias" },
    { href: "/nomina?vista=documentos", label: "Documentos", active: vista === "documentos" },
    { href: "/nomina?vista=extraordinarios", label: "Extraordinarios", active: vista === "extraordinarios" },
    { href: "/nomina?vista=aguinaldo", label: "Aguinaldo", active: vista === "aguinaldo" },
  ];
  const subtitle =
    vista === "documentos"
      ? "Cada folio abre el detalle con documentos y timbrado."
      : vista === "incidencias"
        ? "Periodos con faltantes que impiden cerrar o timbrar."
        : "Semanal y por empresa. Autorizada no se reabre.";
  return (
    <>
      <PageHeader title="Nómina" subtitle={subtitle} />
      <SegmentedNav items={tabs} />
      <ActiveFilters items={vista && vistaLabels[vista] ? [{ label: vistaLabels[vista], clearHref: "/nomina" }] : []} />
      {vista !== "aguinaldo" && vista !== "documentos" ? (
        <FormPanel action={payrollAction} className="mb-4">
          <FormSection title="Nómina semanal" description="Genera el preliminar del lunes que indiques.">
            <Field label="Lunes de la semana"><input name="weekStart" type="date" required className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit">Generar preliminar</Button></FormActions>
        </FormPanel>
      ) : null}
      {vista === "aguinaldo" || !vista ? (
        <FormPanel action={aguinaldoAction} className="mb-4">
          <FormSection title="Aguinaldo" description="Corte anual separado de la nómina semanal.">
            <Field label="Aguinaldo del año"><input name="year" type="number" defaultValue={new Date().getFullYear()} className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Generar aguinaldo</Button></FormActions>
        </FormPanel>
      ) : null}
      {displayed.length === 0 ? <Empty title="Sin nóminas" body="El preliminar junta salario, descuentos, horas extra, prima y bonos." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Periodo</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {displayed.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/nomina/${row.id}`}>{row.folio}</RecordLink></Td>
                    <Td>{row.kind} · {row.periodStart}</Td>
                    <Td><Badge tone={row.status === "PRELIMINAR" ? "warn" : "neutral"}>{row.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={displayed.map((row) => (
            <MobileCard
              key={row.id}
              href={`/nomina/${row.id}`}
              title={row.folio}
              meta={<Badge tone={row.status === "PRELIMINAR" ? "warn" : "neutral"}>{row.status}</Badge>}
            >
              <p>{row.kind} · {row.periodStart}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
