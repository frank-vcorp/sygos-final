import { notFound, redirect } from "next/navigation";
import {
  Button,
  controlClass,
  Empty,
  FilterBar,
  ListCap,
  PageHeader,
  SegmentedNav,
  TextLink,
} from "@/components/ui";
import { ServiciosSupervisorList } from "@/components/servicios-supervisor-list";
import { homePath } from "@/lib/home";
import { can } from "@/lib/permissions";
import {
  SERVICIO_TIPO_PARAM,
  SUPERVISOR_SERVICIO_SECTIONS,
  serviciosListHref,
  serviciosTipoHref,
  type ServicioTipoParam,
} from "@/lib/servicios-catalog";
import { listSupervisorActiveServicios } from "@/lib/servicios-supervisor";
import { requireCompany } from "@/lib/session";

export default async function ServiciosTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tipo } = await params;
  const { q } = await searchParams;
  if (!(tipo in SERVICIO_TIPO_PARAM)) notFound();
  const tipoParam = tipo as ServicioTipoParam;
  const session = await requireCompany();
  if (!can(session.role, "attention.catalog", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }

  if (session.role !== "SUPERVISOR_TECNICO") {
    redirect(serviciosListHref({ tipo: tipoParam, q: q?.trim() }));
  }

  const query = (q ?? "").trim();
  const section = SUPERVISOR_SERVICIO_SECTIONS.find((row) => row.param === tipoParam)!;
  const rows = await listSupervisorActiveServicios(session.activeCompanyId, tipoParam, query);

  return (
    <>
      <PageHeader
        title={section.title}
        subtitle="Solo activas. Las vencidas y las en espera de refacciones se resaltan en la misma lista."
      />
      <SegmentedNav
        items={SUPERVISOR_SERVICIO_SECTIONS.map((opt) => ({
          href: serviciosTipoHref(opt.param, query),
          label: opt.menuLabel,
          active: opt.param === tipoParam,
        }))}
      />
      <FilterBar action={`/servicios/${tipoParam}`}>
        <input name="q" defaultValue={query} placeholder="Folio, cliente, equipo o falla" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">
          Buscar
        </Button>
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "Sin servicios activos"}
          body={
            query
              ? `Nada activo coincide con «${query}» en ${section.title.toLowerCase()}.`
              : `No hay ${section.title.toLowerCase()} activos en este momento.`
          }
          action={query ? <TextLink href={serviciosTipoHref(tipoParam)}>Quitar búsqueda</TextLink> : undefined}
        />
      ) : (
        <ServiciosSupervisorList rows={rows} />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
