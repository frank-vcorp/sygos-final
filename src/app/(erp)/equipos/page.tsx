import { redirect } from "next/navigation";
import { EquiposQueryFilter } from "@/components/compact-list-filters";
import { EquiposCatalogList } from "@/components/equipos-catalog-list";
import { ActionLink, ActiveFilters, Empty, ListCap, PageHeader, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { homePath } from "@/lib/home";
import { coordPageSubtitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function EquiposPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCompany();
  const mayList =
    can(session.role, "equi.view", session.activeCompanyCode)
    && (session.role === "VENTAS" || session.role === "COORDINACION_ADMINISTRACION" || can(session.role, "equipment.catalog", session.activeCompanyCode));
  if (!mayList) redirect(homePath(session.role, session.activeCompanyCode));
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const rows = await prisma.equipment.findMany({
    where: {
      kind: "EQUI",
      originCompanyId: session.activeCompanyId,
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
      ...(query
        ? { OR: [{ folio: { contains: query } }, { model: { contains: query } }, { serial: { contains: query } }, { client: { name: { contains: query } } }] }
        : {}),
    },
    include: { client: { select: { id: true, name: true, isSystem: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const listRows = rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    clientId: row.client.id,
    clientName: row.client.name,
    clientIsSystem: row.client.isSystem,
    identification: [row.brandName, row.model, row.serial].filter(Boolean).join(" · ") || "—",
    custody: row.custody,
    createdAt: row.createdAt.toISOString(),
    detailHref: `/equipos/${row.id}`,
  }));
  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle={coordPageSubtitle(
          coordUsesSidebarNav(session.role),
          session.activeCompanyCode,
          "Identidad EQUI de SYSTRON. El folio no se reutiliza.",
          "Catálogo EQUI",
        )}
        action={can(session.role, "equi.create", session.activeCompanyCode) ? <ActionLink href="/equipos/nuevo">Nuevo EQUI</ActionLink> : null}
      />
      <EquiposQueryFilter q={query} />
      <ActiveFilters items={query ? [{ label: `Búsqueda: ${query}`, clearHref: "/equipos" }] : []} />
      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "No hay equipos"}
          body={query ? `Nada coincide con «${query}».` : "Un EQUI se crea al identificar una unidad física. No se generan equipos de demostración."}
          action={query ? <TextLink href="/equipos">Quitar búsqueda</TextLink> : can(session.role, "equi.create", session.activeCompanyCode) ? <TextLink href="/equipos/nuevo">Nuevo EQUI</TextLink> : undefined}
        />
      ) : (
        <EquiposCatalogList rows={listRows} canEditClient={canEditClient} />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
