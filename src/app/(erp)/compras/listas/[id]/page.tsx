import { notFound, redirect } from "next/navigation";
import { removeShoppingListLineAction, setShoppingListSupplierAction, updateShoppingListLineAction } from "../../actions";
import { ShoppingListDetailActions } from "../shopping-list-detail-actions";
import { Badge, Button, Card, controlClass, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { requirementPartidaLabel } from "@/lib/requirement-display";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { shoppingListKindLabel } from "@/lib/shopping-list-display";
import { requireCompany } from "@/lib/session";

export default async function ListaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const { id } = await params;
  const [list, suppliers, categories, accounts] = await Promise.all([
    prisma.shoppingList.findFirst({
      where: { id, companyId: session.activeCompanyId },
      include: { supplier: true, lines: { include: { requirement: true } }, purchase: true },
    }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!list) notFound();
  const open = list.status === "ABIERTA";
  const allowQuickSupplier = can(session.role, "supplier.operate", session.activeCompanyCode);

  return (
    <>
      <PageHeader
        back={{ href: "/compras/listas", label: "Listas de compras" }}
        title={list.folio}
        subtitle={open ? `${shoppingListKindLabel(list.kind)} · Lista abierta sin movimiento financiero.` : "Lista convertida en compra."}
        action={open ? <RecordLink href="/compras/requerimientos">Agregar requerimiento</RecordLink> : list.purchase ? <RecordLink href={`/compras/${list.purchase.id}`}>Ver compra</RecordLink> : null}
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Proveedor</p>
            <p className="font-semibold">{list.supplier?.name ?? "Sin proveedor"}</p>
            <p className="mt-2"><Badge>{shoppingListKindLabel(list.kind)}</Badge></p>
          </div>
          {open ? (
            <ShoppingListDetailActions
              listId={list.id}
              listFolio={list.folio}
              listKind={list.kind}
              supplierId={list.supplierId}
              supplierName={list.supplier?.name ?? null}
              lineCount={list.lines.length}
              suppliers={suppliers}
              categories={categories}
              accounts={accounts}
              allowQuickSupplier={allowQuickSupplier}
            />
          ) : null}
        </div>
        {open ? (
          <form action={setShoppingListSupplierAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-4">
            <input type="hidden" name="listId" value={list.id} />
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Cambiar proveedor</span>
              <select name="supplierId" defaultValue={list.supplierId ?? ""} className={controlClass}>
                <option value="">Sin proveedor por ahora</option>
                {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <Button type="submit" tone="ghost">Guardar</Button>
          </form>
        ) : null}
      </Card>
      <Table>
        <thead>
          <tr><Th>Origen</Th><Th>Partida</Th><Th>Cantidad</Th>{open ? <Th>Acciones</Th> : null}</tr>
        </thead>
        <tbody>
          {list.lines.map((line) => (
            <tr key={line.id}>
              <Td>{line.requirement.sourceType ?? "Requerimiento"}</Td>
              <Td>
                {open ? (
                  <form action={updateShoppingListLineAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto] sm:items-center">
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <input name="partNumber" defaultValue={line.partNumber} className={controlClass} aria-label="Número de parte" />
                    <input name="description" defaultValue={line.description} className={controlClass} aria-label="Descripción" />
                    <input name="quantity" type="number" min="1" defaultValue={line.quantity} className={controlClass} aria-label="Cantidad" />
                    <Button type="submit" tone="ghost">Guardar</Button>
                  </form>
                ) : (
                  requirementPartidaLabel({ partNumber: line.partNumber, description: line.description })
                )}
              </Td>
              <Td>{line.quantity}</Td>
              {open ? (
                <Td>
                  <form action={removeShoppingListLineAction}>
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <Button type="submit" tone="ghost">Quitar</Button>
                  </form>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
      {open && list.lines.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Agrega requerimientos desde la bandeja de requerimientos para llenar esta lista.</p>
      ) : null}
    </>
  );
}
