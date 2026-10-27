import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";
import { RequirementCreateModal } from "./requirement-create-modal";
import { RequirementFilters } from "./requirement-filters";
import { RequirementListSection } from "./requirement-list-section";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { loadRequirementListContexts } from "@/lib/requirement-list-enrichment";
import { requirementStatusFilter } from "@/lib/requirement-filters";
import { shoppingListKindFromList } from "@/lib/shopping-list-display";
import { requireCompany } from "@/lib/session";

export default async function ComprasRequerimientosPage({ searchParams }: { searchParams: Promise<{ estado?: string; solicitante?: string; fecha?: string }> }) {
  const session = await requireCompany();
  const canManage = can(session.role, "purchase.operate", session.activeCompanyCode);
  const canCreate = can(session.role, "purchase.requirement.create", session.activeCompanyCode);
  const allowRefaccionKind = can(session.role, "purchase.requirement.refaccion", session.activeCompanyCode);
  if (!canManage && !canCreate) redirect("/inicio");
  const params = await searchParams;
  const status = requirementStatusFilter(params.estado);
  const rows = await prisma.requirement.findMany({
    where: { companyId: session.activeCompanyId, status, ...(canManage ? (params.solicitante ? { requesterUserId: params.solicitante } : {}) : { requesterUserId: session.userId }), ...(params.fecha ? { createdAt: { gte: new Date(`${params.fecha}T00:00:00`), lt: new Date(`${params.fecha}T23:59:59`) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const contexts = await loadRequirementListContexts(session.activeCompanyId, rows);
  const [requesters, rowRequesters, suppliers, categories, accounts, shoppingLists] = await Promise.all([
    canManage
      ? prisma.user.findMany({ where: { companyId: session.activeCompanyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    prisma.user.findMany({ where: { id: { in: rows.map((row) => row.requesterUserId) } }, select: { id: true, name: true } }),
    canManage
      ? prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } })
      : Promise.resolve([]),
    canManage
      ? prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    canManage
      ? prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    canManage
      ? prisma.shoppingList.findMany({
          where: { companyId: session.activeCompanyId, status: "ABIERTA" },
          include: { supplier: true, lines: { include: { requirement: { select: { kind: true } } } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const requesterName = new Map(rowRequesters.map((user) => [user.id, user.name]));
  const listRows = rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    partNumber: row.partNumber,
    description: row.description,
    kind: row.kind,
    status: row.status,
    requesterName: requesterName.get(row.requesterUserId) ?? "—",
    shoppingListId: row.shoppingListId,
    purchaseId: row.purchaseId,
    context: contexts.get(row.id)!,
  }));
  const groups = [
    { title: "Refacciones", rows: listRows.filter((row) => row.kind === "REFACCION") },
    { title: "Generales", rows: listRows.filter((row) => row.kind !== "REFACCION") },
  ].filter((group) => group.rows.length);
  return (
    <>
      <PageHeader
        title="Requerimientos"
        subtitle={
          canManage
            ? "Solicitudes de compra y refacciones que el gerente convierte en pedido."
            : "Tus solicitudes de compra; el gerente de compras las atiende."
        }
        action={
          canCreate ? (
            <RequirementCreateModal lockKind={!allowRefaccionKind} defaultKind="GENERAL" />
          ) : null
        }
      />
      <RequirementFilters estado={status} solicitante={params.solicitante ?? ""} fecha={params.fecha ?? ""} requesters={requesters} canFilterRequester={canManage} />
      {rows.length === 0 ? (
        <Empty title={`Sin requerimientos ${status.toLowerCase()}`} body="Crea una solicitud con cantidad y, si aplica, número de parte." />
      ) : (
        groups.map((group) => (
          <RequirementListSection
            key={group.title}
            title={group.title}
            rows={group.rows}
            canManage={canManage}
            showRequester={canManage}
            suppliers={suppliers}
            categories={categories}
            accounts={accounts}
            allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
            shoppingLists={shoppingLists.map((list) => ({
              id: list.id,
              folio: list.folio,
              kind: shoppingListKindFromList(list),
              supplierId: list.supplierId,
              supplierName: list.supplier?.name ?? null,
            }))}
          />
        ))
      )}
    </>
  );
}
