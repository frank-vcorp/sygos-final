import Link from "next/link";
import { redirect } from "next/navigation";
import { createPartAction, stockAction } from "./actions";
import { Badge, Button, controlClass, Empty, Field, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function InventarioPage() {
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode)) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company) redirect("/empresa");
  if (!company.inventoryEnabled) {
    return (
      <>
        <PageHeader title="Inventario" subtitle={company.name} />
        <Empty
          title="Inventario deshabilitado"
          body="Servomotores puede operar sin existencias. Solo el Administrador habilita este inventario, y al hacerlo empieza vacío, separado de SYSTRON."
        />
      </>
    );
  }
  const parts = await prisma.part.findMany({
    where: { companyId: company.id, active: true },
    orderBy: { partNumber: "asc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Piezas de esta empresa. Sin reservas, sin ubicaciones y sin costeo."
        action={<Link href="/inventario/conteo" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">Conteo físico</Link>}
      />
      <div className="mb-4 flex gap-2">
        <a href="/inventario/export" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">Exportar</a>
      </div>
      {parts.length === 0 ? (
        <Empty title="Sin refacciones" body="El catálogo empieza vacío. Una parte nueva no inventa existencia." />
      ) : (
        <Table>
          <thead><tr><Th>Número</Th><Th>Descripción</Th><Th>Existencia</Th><Th>Mín / máx</Th><Th>Movimiento</Th></tr></thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id}>
                <Td>{part.partNumber}</Td>
                <Td>{part.description}</Td>
                <Td>
                  {part.qty}
                  {part.minQty != null && part.qty < part.minQty ? <Badge tone="warn">bajo mínimo</Badge> : null}
                  {part.maxQty != null && part.qty > part.maxQty ? <Badge tone="warn">sobre máximo</Badge> : null}
                </Td>
                <Td>{part.minQty ?? "—"} / {part.maxQty ?? "—"}</Td>
                <Td>
                  <form action={stockAction} className="flex flex-wrap gap-1">
                    <input type="hidden" name="partId" value={part.id} />
                    <input type="hidden" name="version" value={part.version} />
                    <select name="kind" className="rounded-md border border-[var(--line)] px-2 py-1 text-sm">
                      <option value="ENTRADA">Entrada</option>
                      <option value="SALIDA">Salida</option>
                    </select>
                    <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-sm" />
                    <Button type="submit" tone="ghost">Aplicar</Button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <form action={createPartAction} className="mt-4 grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Nueva refacción</h2>
        <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
        <Field label="Descripción"><input name="description" required className={controlClass} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mínimo informativo"><input name="minQty" type="number" min={0} className={controlClass} /></Field>
          <Field label="Máximo informativo"><input name="maxQty" type="number" min={0} className={controlClass} /></Field>
        </div>
        <Button type="submit">Agregar al catálogo</Button>
      </form>
    </>
  );
}
