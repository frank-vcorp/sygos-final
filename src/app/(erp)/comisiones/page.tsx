import { redirect } from "next/navigation";
import { commissionAction } from "./actions";
import { Badge, Button, controlClass, Empty, Field, FormActions, FormPanel, FormSection, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
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
      <FormPanel action={commissionAction} className="mb-4">
        <FormSection title="Corte mensual" description="Calcula comisiones a partir de la facturación del mes.">
          <Field label="Mes"><input name="month" type="month" required className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Generar preliminar</Button></FormActions>
      </FormPanel>
      {rows.length === 0 ? <Empty title="Sin comisiones" body="El corte conserva la facturación, el porcentaje, el cálculo original y el ajuste." /> : (
        <Table>
          <thead><tr><Th>Mes</Th><Th>Estado</Th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><Td><RecordLink href={`/comisiones/${row.id}`}>{row.month}</RecordLink></Td><Td><Badge>{row.status}</Badge></Td></tr>)}</tbody>
        </Table>
      )}
    </>
  );
}
