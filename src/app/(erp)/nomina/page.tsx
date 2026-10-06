import Link from "next/link";
import { redirect } from "next/navigation";
import { aguinaldoAction, payrollAction } from "./actions";
import { Badge, controlClass, Empty, Field, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NominaPage() {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const rows = await prisma.payrollPeriod.findMany({ where: { companyId: session.activeCompanyId }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <>
      <PageHeader title="Nómina" subtitle="Semanal y por empresa. Autorizada no se reabre." />
      <form action={payrollAction} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Lunes de la semana"><input name="weekStart" type="date" required className={controlClass} /></Field>
        <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Generar preliminar</button>
      </form>
      <form action={aguinaldoAction} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Aguinaldo del año"><input name="year" type="number" defaultValue={new Date().getFullYear()} className={controlClass} /></Field>
        <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Generar aguinaldo</button>
      </form>
      {rows.length === 0 ? <Empty title="Sin nóminas" body="El preliminar junta salario, descuentos, horas extra, prima y bonos." /> : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Periodo</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><Link href={`/nomina/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td>
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
