import Link from "next/link";
import { redirect } from "next/navigation";
import { commissionAction } from "./actions";
import { Badge, controlClass, Empty, Field, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComisionesPage() {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage")) redirect("/inicio");
  const rows = await prisma.commissionRun.findMany({ where: { companyId: session.activeCompanyId }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Comisiones" subtitle="Proceso mensual, separado de la nómina. La factura libre no entra." />
      <form action={commissionAction} className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Mes"><input name="month" type="month" required className={controlClass} /></Field>
        <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Generar preliminar</button>
      </form>
      {rows.length === 0 ? <Empty title="Sin comisiones" body="El corte conserva la facturación, el porcentaje, el cálculo original y el ajuste." /> : (
        <Table>
          <thead><tr><Th>Mes</Th><Th>Estado</Th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><Td><Link href={`/comisiones/${row.id}`} className="font-medium text-[var(--accent)]">{row.month}</Link></Td><Td><Badge>{row.status}</Badge></Td></tr>)}</tbody>
        </Table>
      )}
    </>
  );
}
