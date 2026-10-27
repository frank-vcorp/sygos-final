import { redirect } from "next/navigation";
import { ActionLink, ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { PurchaseFilters } from "./purchase-filters";
import { PurchaseRegistrationModal } from "@/components/purchase-registration-modal";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { purchaseListHref } from "@/lib/purchase-filter-links";
import { requireCompany } from "@/lib/session";

const STATUS: Record<string, string> = {
  PENDIENTE_VALIDAR: "Pendiente de validar",
  PENDIENTE_AUTORIZACION: "Pendiente de autorización",
  AUTORIZADA: "Autorizada",
  RECHAZADA: "Rechazada",
  PROCESADA: "Procesada",
  CANCELADA: "Cancelada",
  ELIMINADA: "Eliminada",
};

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string; estado?: string; fecha?: string; categoria?: string; proveedor?: string; solicitante?: string; registrar?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/inicio");
  const { vista, q, estado, fecha, categoria, proveedor, solicitante, registrar } = await searchParams;
  if (registrar === "1") redirect("/compras/nueva");
  const query = (q ?? "").trim();
  const view = vista === "autorizar" ? "autorizar" : vista === "procesar" ? "procesar" : vista === "oc" ? "oc" : vista === "legacy" ? "legacy" : "compras";
  const estadoCompras = view === "compras" ? (estado ?? "PENDIENTE_VALIDAR") : estado;
  const dateFilter = fecha ? { gte: new Date(`${fecha}T00:00:00`), lt: new Date(`${fecha}T23:59:59`) } : undefined;
  const where = view === "autorizar"
    ? { kind: "OC", status: "PENDIENTE_AUTORIZACION" }
    : view === "procesar"
      ? { OR: [{ kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, { kind: "OC", status: "AUTORIZADA" }] }
      : view === "oc"
        ? { kind: "OC", status: { not: "ELIMINADA" } }
        : view === "legacy"
          ? { kind: "DIRECTA", status: { not: "ELIMINADA" } }
          : { kind: "COMPRA", status: estadoCompras ?? { not: "ELIMINADA" } };
  const rows = await prisma.purchase.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...where,
      ...(query
        ? {
            OR: [{ folio: { contains: query } }, { concept: { contains: query } }],
          }
        : {}),
      ...(categoria && view === "compras" ? { expenseCategoryId: categoria } : {}),
      ...(proveedor ? { supplierId: proveedor } : {}),
      ...(solicitante ? { requesterUserId: solicitante } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const tabs: Array<readonly [string, string]> = [
    ["compras", "Compras"],
    ["oc", "Órdenes de compra"],
    ["procesar", "Por procesar"],
    ...(session.role === "CEO" || session.role === "ADMINISTRADOR" ? [["autorizar", "Por autorizar"] as const] : []),
  ];
  const viewLabel = tabs.find(([key]) => key === view)?.[1] ?? view;
  const [suppliers, categories, accounts, requesters] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { companyId: session.activeCompanyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const requesterName = new Map(requesters.map((user) => [user.id, user.name]));
  const filters = (omit?: "vista" | "q" | "estado" | "fecha" | "categoria" | "proveedor" | "solicitante") => purchaseListHref({
    vista: omit === "vista" ? undefined : view,
    q: omit === "q" ? undefined : query,
    estado: omit === "estado" ? undefined : estadoCompras,
    fecha: omit === "fecha" ? undefined : fecha,
    categoria: omit === "categoria" ? undefined : categoria,
    proveedor: omit === "proveedor" ? undefined : proveedor,
    solicitante: omit === "solicitante" ? undefined : solicitante,
  });
  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Consulta compras realizadas y registra compras urgentes sin requerimiento."
        action={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/compras/listas" tone="ghost">Listas de compras</ActionLink>
            <PurchaseRegistrationModal
              suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: `${supplier.name} · ${supplier.currency}` }))}
              categories={categories}
              accounts={accounts}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              returnHref={filters()}
            />
          </div>
        }
      />
      <PurchaseFilters
        vista={view}
        q={query}
        estado={estadoCompras ?? ""}
        fecha={fecha ?? ""}
        categoria={categoria ?? ""}
        proveedor={proveedor ?? ""}
        solicitante={solicitante ?? ""}
        showPurchaseFilters={view === "compras"}
        suppliers={suppliers}
        categories={categories}
        requesters={requesters}
      />
      <ActiveFilters
        items={[
          ...(view !== "compras" ? [{ label: viewLabel, clearHref: filters("vista") }] : []),
          ...(view === "compras" && estadoCompras ? [{ label: STATUS[estadoCompras] ?? estadoCompras, clearHref: filters("estado") }] : []),
          ...(fecha ? [{ label: `Fecha: ${fecha}`, clearHref: filters("fecha") }] : []),
          ...(proveedor ? [{ label: `Proveedor: ${suppliers.find((supplier) => supplier.id === proveedor)?.name ?? "Seleccionado"}`, clearHref: filters("proveedor") }] : []),
          ...(categoria ? [{ label: `Categoría: ${categories.find((category) => category.id === categoria)?.name ?? "Seleccionada"}`, clearHref: filters("categoria") }] : []),
          ...(solicitante ? [{ label: `Solicitante: ${requesterName.get(solicitante) ?? "Seleccionado"}`, clearHref: filters("solicitante") }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: filters("q") }] : []),
        ]}
      />
      {rows.length === 0 ? <Empty title="Sin compras en esta vista" body="La compra directa consume el presupuesto del mes desde que se registra." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Categoría</Th><Th>Solicitante</Th><Th>Importe</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/compras/${row.id}`}>{row.folio}</RecordLink></Td>
                    <Td>{row.supplier?.name ?? "Sin proveedor"}</Td>
                    <Td>{[row.expenseCategory, row.expenseSubcategory].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td>{requesterName.get(row.requesterUserId) ?? "—"}</Td>
                    <Td>{money(row.amount)}</Td>
                    <Td><Badge>{STATUS[row.status] ?? row.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => (
            <MobileCard
              key={row.id}
              href={`/compras/${row.id}`}
              title={row.folio}
              meta={<Badge>{STATUS[row.status] ?? row.status}</Badge>}
            >
              <p>{row.supplier?.name ?? "Sin proveedor"}</p>
              <p>{[row.expenseCategory, row.expenseSubcategory].filter(Boolean).join(" · ") || "Sin categoría"}</p>
              <p className="mt-1 font-medium">{money(row.amount)}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
