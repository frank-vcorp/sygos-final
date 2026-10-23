import {
  ActionLink,
  ActiveFilters,
  Button,
  controlClass,
  Empty,
  FilterBar,
  ListCap,
  PageHeader,
  SegmentedNav,
  TextLink,
} from "@/components/ui";
import { salesPortfolioUserId } from "@/lib/sales-assignment";
import type { Role } from "@/lib/roles";
import { ServiciosSupervisorList } from "@/components/servicios-supervisor-list";
import {
  serviciosBandejaHref,
  SERVICIOS_BANDEJA_ACTIVOS,
  SERVICIOS_BANDEJA_HISTORIAL,
  type ServiciosVista,
} from "@/lib/servicios-catalog";
import {
  filterServicioBandejaForGerentePanel,
  GERENTE_SERVICIO_PANEL_FILTROS,
  loadGerenteServicioPanelContext,
  parseGerenteServicioPanelFiltro,
} from "@/lib/gerente-servicios-panel-filters";
import {
  listActiveServicios,
  listHistorialServicios,
  type ServicioBandejaRow,
} from "@/lib/servicios-supervisor";

const HISTORIAL_ESTADO_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  { value: "PENDIENTE_VALIDACION", label: "Pendiente de validación" },
  { value: "VALIDADO", label: "Validado" },
  { value: "TERMINADA", label: "Reparación terminada" },
  { value: "SIN_REPARACION", label: "Sin reparación" },
  { value: "CANCELADA", label: "Cancelada" },
] as const;

function CalendarFilter({
  desde,
  hasta,
  clearHref,
}: {
  desde?: string;
  hasta?: string;
  clearHref: string;
}) {
  const hasRange = Boolean(desde || hasta);
  return (
    <details className="relative shrink-0">
      <summary
        title="Filtrar por fechas"
        aria-label="Filtrar por fechas"
        className="relative inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-[#cbd8e6] bg-white text-[#486078] transition-colors hover:border-[#087d99] hover:bg-[#f3f8fb] hover:text-[#087d99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7e9f2] [&::-webkit-details-marker]:hidden"
      >
        <span className="sr-only">Filtrar por fechas</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {hasRange ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" /> : null}
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-white p-4 shadow-[0_14px_34px_rgba(20,45,75,0.16)]">
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--ink)]">Filtrar por fechas</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Usa una fecha o define un rango completo.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Desde</span>
            <input type="date" name="desde" defaultValue={desde ?? ""} aria-label="Desde" className={controlClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Hasta</span>
            <input type="date" name="hasta" defaultValue={hasta ?? ""} aria-label="Hasta" className={controlClass} />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          {hasRange ? <TextLink href={clearHref} className="text-xs">Limpiar</TextLink> : <span />}
          <Button type="submit" tone="ghost" className="px-4">Aplicar fechas</Button>
        </div>
      </div>
    </details>
  );
}

function bandejaSubtitle(role: Role, vista: ServiciosVista, technician: boolean): string {
  const sales = role === "VENTAS";
  if (vista === "historial") {
    if (technician) {
      return "Operaciones cerradas o canceladas en las que participaste.";
    }
    if (sales) {
      return "Operaciones cerradas o canceladas de tu cartera.";
    }
    return "Operaciones cerradas o canceladas del taller.";
  }
  if (technician) {
    return "Operaciones abiertas asignadas a ti. Los SLA vencidos y la espera de refacciones se resaltan en la fila.";
  }
  if (sales) {
    return "Operaciones abiertas de tu cartera con ingreso confirmado.";
  }
  return "Operaciones abiertas con ingreso confirmado.";
}

export async function ServiciosTecnicoBandeja({
  companyId,
  userId,
  role,
  technician,
  canCreate,
  vista,
  estado,
  query,
  desde,
  hasta,
  panelFiltro,
}: {
  companyId: string;
  userId: string;
  role: Role;
  technician: boolean;
  canCreate: boolean;
  vista: ServiciosVista;
  estado?: string;
  query: string;
  desde?: string;
  hasta?: string;
  panelFiltro?: string;
}) {
  const gerentePanelFiltro = vista === "activos" ? parseGerenteServicioPanelFiltro(panelFiltro) : null;
  const estadoLabel =
    vista === "historial" && estado && estado !== "todos"
      ? HISTORIAL_ESTADO_OPTIONS.find((opt) => opt.value === estado)?.label
      : null;
  const navBase = {
    vista,
    q: query,
    desde,
    hasta,
    estado: estado && estado !== "todos" ? estado : undefined,
    filtro: gerentePanelFiltro ?? undefined,
  };
  const portfolioUserId = salesPortfolioUserId(role, userId);
  const listScope = {
    ...(technician ? { assigneeUserId: userId } : {}),
    ...(portfolioUserId ? { clientOwnerUserId: portfolioUserId } : {}),
  };
  const dateRange = { desde, hasta };

  let rows =
    vista === "historial"
      ? await listHistorialServicios(companyId, query, {
          ...listScope,
          status: estado && estado !== "todos" ? estado : null,
          ...dateRange,
        })
      : await listActiveServicios(companyId, query, { ...listScope, ...dateRange });

  if (gerentePanelFiltro) {
    const servicioRows = rows.filter((row): row is ServicioBandejaRow => row.kind === "servicio");
    const panelCtx = await loadGerenteServicioPanelContext(companyId);
    rows = filterServicioBandejaForGerentePanel(servicioRows, gerentePanelFiltro, panelCtx);
  }

  const formAction = vista === "historial" ? SERVICIOS_BANDEJA_HISTORIAL : SERVICIOS_BANDEJA_ACTIVOS;
  const panelFiltroLabel = gerentePanelFiltro ? GERENTE_SERVICIO_PANEL_FILTROS[gerentePanelFiltro] : null;

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle={bandejaSubtitle(role, vista, technician)}
        action={canCreate ? <ActionLink href="/servicios/nuevo">Nuevo servicio</ActionLink> : null}
      />
      <SegmentedNav
        items={[
          {
            href: serviciosBandejaHref({ ...navBase, vista: "activos" }),
            label: "Activos",
            active: vista === "activos",
          },
          {
            href: serviciosBandejaHref({ ...navBase, vista: "historial" }),
            label: "Historial",
            active: vista === "historial",
          },
        ]}
      />
      <FilterBar action={formAction}>
        <input
          name="q"
          defaultValue={query}
          placeholder="Folio, cliente, equipo o falla"
          className={`${controlClass} min-w-0 flex-1`}
        />
        <CalendarFilter
          desde={desde}
          hasta={hasta}
          clearHref={serviciosBandejaHref({ vista, q: query, estado })}
        />
        {vista === "historial" ? (
          <select
            name="estado"
            defaultValue={estado && estado !== "todos" ? estado : "todos"}
            aria-label="Estado"
            className={`${controlClass} sm:w-[190px]`}
          >
            {HISTORIAL_ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(panelFiltroLabel
            ? [{
                label: panelFiltroLabel,
                clearHref: serviciosBandejaHref({ vista, q: query, desde, hasta, estado }),
              }]
            : []),
          ...(estadoLabel ? [{ label: estadoLabel, clearHref: serviciosBandejaHref({ vista, q: query, desde, hasta, filtro: gerentePanelFiltro ?? undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: serviciosBandejaHref({ vista, desde, hasta, estado }) }] : []),
          ...(desde || hasta
            ? [{
                label: desde && hasta ? `Fechas: ${desde} – ${hasta}` : desde ? `Desde ${desde}` : `Hasta ${hasta}`,
                clearHref: serviciosBandejaHref({ vista, q: query, estado }),
              }]
            : []),
        ]}
      />

      {rows.length === 0 ? (
        <Empty
          title={query || desde || hasta ? "Sin coincidencias" : vista === "historial" ? "Sin historial" : "Sin servicios activos"}
          body={
            query || desde || hasta
              ? "Nada coincide con los filtros aplicados."
              : vista === "historial"
                ? "Aún no hay servicios cerrados o cancelados que mostrar."
                : "No hay servicios activos en este momento."
          }
          action={
            query || desde || hasta ? (
              <TextLink href={serviciosBandejaHref({ vista })}>Quitar filtros</TextLink>
            ) : undefined
          }
        />
      ) : (
        <ServiciosSupervisorList rows={rows} role={role} variant={vista === "historial" ? "historial" : "activos"} />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
