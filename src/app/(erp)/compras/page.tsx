import { redirect } from "next/navigation";
import { ActionLink, ActiveFilters, Badge, Button, controlClass, Empty, FilterBar, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
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

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string; estado?: string; fecha?: string; categoria?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/inicio");
  const { vista, q, estado, fecha, categoria } = await searchParams;
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
            OR: [{ folio: { contains: query } }, { supplier: { name: { contains: query } } }],
          }
        : {}),
      ...(categoria && view === "compras" ? { expenseCategory: { contains: categoria } } : {}),
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
  return (
    <>
      <PageHeader title="Compras" subtitle="Consulta compras realizadas y registra compras urgentes sin requerimiento." action={<div className="flex gap-2"><ActionLink href="/compras/listas">Listas de compras</ActionLink><ActionLink href="/compras/registrar">Registrar compra</ActionLink></div>} />
      <FilterBar action="/compras">
        <select name="vista" defaultValue={view} aria-label="Vista de compras" className={`${controlClass} sm:w-[210px]`}>
          {tabs.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {view === "compras" ? <select name="estado" defaultValue={estado ?? ""} className={controlClass}><option value="">Todos los estados</option><option value="PENDIENTE_VALIDAR">Pendiente de validación</option></select> : null}
        {view === "compras" ? <input name="fecha" type="date" defaultValue={fecha ?? ""} className={controlClass} /> : null}
        {view === "compras" ? <input name="categoria" defaultValue={categoria ?? ""} placeholder="Categoría" className={controlClass} /> : null}
        <input name="q" defaultValue={query} placeholder="Folio o proveedor" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(view !== "compras" ? [{ label: viewLabel, clearHref: listHref("/compras", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/compras", { vista: view !== "compras" ? view : undefined }) }] : []),
        ]}
      />
      <p className="mb-4 flex gap-4 text-sm"><TextLink href="/compras/requerimientos">Requerimientos</TextLink><TextLink href="/compras/listas">Listas de compras</TextLink><TextLink href="/compras/oc">Nueva O.C.</TextLink></p>
      {rows.length === 0 ? <Empty title="Sin compras en esta vista" body="La compra directa consume el presupuesto del mes desde que se registra." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Importe</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td><RecordLink href={`/compras/${row.id}`}>{row.folio}</RecordLink></Td>
                    <Td>{row.supplier?.name ?? "Sin proveedor"}</Td>
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
              <p className="mt-1 font-medium">{money(row.amount)}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
