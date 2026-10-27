import { notFound, redirect } from "next/navigation";
import { ShoppingListDetailActions } from "../shopping-list-detail-actions";
import { ShoppingListLineRow } from "../shopping-list-line-row";
import { ShoppingListSupplierField } from "../shopping-list-supplier-field";
import { RequirementCreateModal } from "../../requerimientos/requirement-create-modal";
import { Badge, Card, PageHeader, RecordLink, Table, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { shoppingListKindFromList, shoppingListKindLabel, normalizeShoppingListKind } from "@/lib/shopping-list-display";
import { requireCompany } from "@/lib/session";

export default async function ListaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const canCreateRequirement = can(session.role, "purchase.requirement.create", session.activeCompanyCode);
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
  const listKind = shoppingListKindFromList(list);
  const requirementKind = normalizeShoppingListKind(listKind);

  return (
    <>
      <PageHeader
        back={{ href: "/compras/listas", label: "Listas de compras" }}
        title={list.folio}
        subtitle={open ? `${shoppingListKindLabel(listKind)} · Lista abierta sin movimiento financiero.` : "Lista convertida en compra."}
        action={
          open && canCreateRequirement ? (
            <RequirementCreateModal
              defaultKind={requirementKind}
              lockKind
              shoppingListId={list.id}
              triggerLabel="Agregar requerimiento"
              triggerVariant="record"
            />
          ) : !open && list.purchase ? (
            <RecordLink href={`/compras/${list.purchase.id}`}>Ver compra</RecordLink>
          ) : null
        }
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Proveedor</p>
            <p className="font-semibold">{list.supplier?.name ?? "Sin proveedor"}</p>
            <p className="mt-2"><Badge>{shoppingListKindLabel(listKind)}</Badge></p>
          </div>
          {open ? (
            <ShoppingListDetailActions
              listId={list.id}
              listFolio={list.folio}
              listKind={listKind}
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
          <ShoppingListSupplierField listId={list.id} supplierId={list.supplierId} suppliers={suppliers} />
        ) : null}
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Cantidad</Th>
            <Th>Origen</Th>
            <Th>Partida</Th>
            {open ? <Th>Acciones</Th> : null}
          </tr>
        </thead>
        <tbody>
          {list.lines.map((line) => (
            <ShoppingListLineRow
              key={line.id}
              listId={list.id}
              lineId={line.id}
              origin={line.requirement.sourceType ?? "Requerimiento"}
              initial={{ partNumber: line.partNumber, description: line.description, quantity: line.quantity }}
              open={open}
            />
          ))}
        </tbody>
      </Table>
      {open && list.lines.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Usa &quot;Agregar requerimiento&quot; para capturar partidas directamente en esta lista.
        </p>
      ) : null}
    </>
  );
}
