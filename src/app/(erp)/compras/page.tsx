import { redirect } from "next/navigation";
import { ActionLink, ActiveFilters, Badge, Button, controlClass, Empty, FilterBar, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { PurchaseRegistrationModal } from "@/components/purchase-registration-modal";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
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
  const query = (q ?? "").trim();
  const view = vista === "autorizar" ? "autorizar" : vista === "procesar" ? "procesar" : vista === "oc" ? "oc" : vista === "legacy" ? "legacy" : "compras";
  const dateFilter = fecha ? { gte: new Date(`${fecha}T00:00:00`), lt: new Date(`${fecha}T23:59:59`) } : undefined;
  const where = view === "autorizar"
    ? { kind: "OC", status: "PENDIENTE_AUTORIZACION" }
    : view === "procesar"
      ? { OR: [{ kind: "DIRECTA", status: "PENDIENTE_VALIDAR" }, { kind: "OC", status: "AUTORIZADA" }] }
      : view === "oc"
        ? { kind: "OC", status: { not: "ELIMINADA" } }
        : view === "legacy"
          ? { kind: "DIRECTA", status: { not: "ELIMINADA" } }
          : { kind: "COMPRA", ...(estado ? { status: estado } : { status: { not: "ELIMINADA" } }) };
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
  const tabs = [
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
  const filters = (omit?: "vista" | "q" | "estado" | "fecha" | "categoria" | "proveedor" | "solicitante") => listHref("/compras", {
    vista: omit === "vista" || view === "compras" ? undefined : view,
    q: omit === "q" ? undefined : query || undefined,
    estado: omit === "estado" ? undefined : estado,
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
              initiallyOpen={registrar === "1"}
              returnHref={filters()}
            />
          </div>
        }
      />
      <FilterBar action="/compras">
        <select name="vista" defaultValue={view} aria-label="Vista de compras" className={`${controlClass} sm:w-[210px]`}>
          {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {view === "compras" ? <select name="estado" defaultValue={estado ?? ""} className={controlClass}><option value="">Todos los estados</option><option value="PENDIENTE_VALIDAR">Pendiente de validación</option></select> : null}
        {view === "compras" ? <input name="fecha" type="date" defaultValue={fecha ?? ""} className={controlClass} /> : null}
        {view === "compras" ? <select name="proveedor" defaultValue={proveedor ?? ""} className={controlClass} aria-label="Proveedor"><option value="">Todos los proveedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select> : null}
        {view === "compras" ? <select name="categoria" defaultValue={categoria ?? ""} className={controlClass} aria-label="Categoría de egreso"><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : null}
        {view === "compras" ? <select name="solicitante" defaultValue={solicitante ?? ""} className={controlClass} aria-label="Solicitante"><option value="">Todos los solicitantes</option>{requesters.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select> : null}
        <input name="q" defaultValue={query} placeholder="Folio o descripción" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(view !== "compras" ? [{ label: viewLabel, clearHref: filters("vista") }] : []),
          ...(estado ? [{ label: STATUS[estado] ?? estado, clearHref: filters("estado") }] : []),
          ...(fecha ? [{ label: `Fecha: ${fecha}`, clearHref: filters("fecha") }] : []),
          ...(proveedor ? [{ label: `Proveedor: ${suppliers.find((supplier) => supplier.id === proveedor)?.name ?? "Seleccionado"}`, clearHref: filters("proveedor") }] : []),
          ...(categoria ? [{ label: `Categoría: ${categories.find((category) => category.id === categoria)?.name ?? "Seleccionada"}`, clearHref: filters("categoria") }] : []),
          ...(solicitante ? [{ label: `Solicitante: ${requesterName.get(solicitante) ?? "Seleccionado"}`, clearHref: filters("solicitante") }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: filters("q") }] : []),
        ]}
      />
      <p className="mb-4 flex flex-wrap gap-2 text-sm"><ActionLink href="/compras/requerimientos" tone="ghost" className="min-h-9 px-2.5">Requerimientos</ActionLink><ActionLink href="/compras/listas" tone="ghost" className="min-h-9 px-2.5">Listas de compras</ActionLink><ActionLink href="/compras/oc" tone="ghost" className="min-h-9 px-2.5">Nueva O.C.</ActionLink></p>
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
