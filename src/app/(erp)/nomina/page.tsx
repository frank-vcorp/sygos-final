import { redirect } from "next/navigation";
import { aguinaldoAction, payrollAction } from "./actions";
import { Badge, controlClass, Empty, Field, PageHeader, RecordLink, SegmentedNav, Table, Td, Th } from "@/components/ui";
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
        : vista === "aguinaldo"
          ? rows.filter((row) => row.kind === "AGUINALDO")
          : vista === "extraordinarios"
            ? rows.filter((row) => row.kind !== "SEMANAL" && row.kind !== "AGUINALDO")
            : rows;
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
      {vista !== "aguinaldo" ? <form action={payrollAction} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Lunes de la semana"><input name="weekStart" type="date" required className={controlClass} /></Field>
        <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Generar preliminar</button>
      </form> : null}
      {vista === "aguinaldo" || !vista ? <form action={aguinaldoAction} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Aguinaldo del año"><input name="year" type="number" defaultValue={new Date().getFullYear()} className={controlClass} /></Field>
        <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Generar aguinaldo</button>
      </form> : null}
      {displayed.length === 0 ? <Empty title="Sin nóminas" body="El preliminar junta salario, descuentos, horas extra, prima y bonos." /> : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Periodo</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {displayed.map((row) => (
              <tr key={row.id}>
                <Td><RecordLink href={`/nomina/${row.id}`}>{row.folio}</RecordLink></Td>
                <Td>{row.kind} · {row.periodStart}</Td>
                <Td><Badge>{row.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
