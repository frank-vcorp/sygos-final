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
  SERVICIO_TIPO_OPTIONS,
  SERVICIO_TIPO_PARAM,
  serviciosBandejaHref,
  SERVICIOS_BANDEJA_ACTIVOS,
  SERVICIOS_BANDEJA_HISTORIAL,
  type ServicioTipoParam,
  type ServiciosVista,
} from "@/lib/servicios-catalog";
import { listActiveServicios, listHistorialServicios } from "@/lib/servicios-supervisor";

const HISTORIAL_ESTADO_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  { value: "VALIDADO", label: "Validado" },
  { value: "TERMINADA", label: "Reparación terminada" },
  { value: "SIN_REPARACION", label: "Sin reparación" },
  { value: "CANCELADA", label: "Cancelada" },
] as const;

function CalendarFilter({
  name,
  label,
  value,
}: {
  name: "desde" | "hasta";
  label: string;
  value?: string;
}) {
  const title = value ? `${label}: ${value}` : label;
  return (
    <label
      title={title}
      className="relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#cbd8e6] bg-white text-[#486078] transition-colors hover:border-[#087d99] hover:bg-[#f3f8fb] hover:text-[#087d99] focus-within:border-[#087d99] focus-within:ring-2 focus-within:ring-[#c7e9f2]"
    >
      <span className="sr-only">{title}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <input
        type="date"
        name={name}
        defaultValue={value ?? ""}
        aria-label={title}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      {value ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" /> : null}
    </label>
  );
}

function bandejaSubtitle(role: Role, vista: ServiciosVista, technician: boolean): string {
  const sales = role === "VENTAS";
  if (vista === "historial") {
    if (technician) {
      return "Operaciones cerradas o canceladas en las que participaste. No incluye pendientes de ingreso.";
    }
    if (sales) {
      return "Operaciones cerradas o canceladas de tu cartera. No incluye pendientes de ingreso.";
    }
    return "Operaciones cerradas o canceladas del taller. No incluye pendientes de ingreso.";
  }
  if (technician) {
    return "Solo operaciones abiertas asignadas a ti. Vencidas y en espera de refacciones se resaltan.";
  }
  if (sales) {
    return "Operaciones abiertas de tu cartera con ingreso confirmado. Vencidas y en espera de refacciones se resaltan.";
  }
  return "Operaciones abiertas con ingreso confirmado. Vencidas y en espera de refacciones se resaltan.";
}

export async function ServiciosTecnicoBandeja({
  companyId,
  userId,
  role,
  technician,
  canCreate,
  vista,
  tipo,
  estado,
  query,
  desde,
  hasta,
}: {
  companyId: string;
  userId: string;
  role: Role;
  technician: boolean;
  canCreate: boolean;
  vista: ServiciosVista;
  tipo?: string;
  estado?: string;
  query: string;
  desde?: string;
  hasta?: string;
}) {
  const tipoParam =
    tipo && tipo !== "todos" && tipo in SERVICIO_TIPO_PARAM ? (tipo as ServicioTipoParam) : null;
  const tipoLabel = tipoParam ? SERVICIO_TIPO_OPTIONS.find((opt) => opt.param === tipoParam)?.label : null;
  const estadoLabel =
    vista === "historial" && estado && estado !== "todos"
      ? HISTORIAL_ESTADO_OPTIONS.find((opt) => opt.value === estado)?.label
      : null;
  const navBase = {
    vista,
    tipo: tipo && tipo !== "todos" ? tipo : "todos",
    q: query,
    desde,
    hasta,
    estado: estado && estado !== "todos" ? estado : undefined,
  };
  const portfolioUserId = salesPortfolioUserId(role, userId);
  const listScope = {
    ...(technician ? { assigneeUserId: userId } : {}),
    ...(portfolioUserId ? { clientOwnerUserId: portfolioUserId } : {}),
  };
  const dateRange = { desde, hasta };

  const rows =
    vista === "historial"
      ? await listHistorialServicios(companyId, query, {
          ...listScope,
          tipo: tipoParam,
          status: estado && estado !== "todos" ? estado : null,
          ...dateRange,
        })
      : await listActiveServicios(companyId, query, { ...listScope, tipo: tipoParam, ...dateRange });

  const formAction = vista === "historial" ? SERVICIOS_BANDEJA_HISTORIAL : SERVICIOS_BANDEJA_ACTIVOS;

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
        <select
          name="tipo"
          defaultValue={tipo && tipo !== "todos" ? tipo : "todos"}
          aria-label="Tipo de servicio"
          className={`${controlClass} sm:w-[190px]`}
        >
          <option value="todos">Todos los tipos</option>
          {SERVICIO_TIPO_OPTIONS.map((opt) => (
            <option key={opt.param} value={opt.param}>
              {opt.label}
            </option>
          ))}
        </select>
        <CalendarFilter name="desde" label="Filtrar desde" value={desde} />
        <CalendarFilter name="hasta" label="Filtrar hasta" value={hasta} />
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
          ...(tipoParam && tipoLabel ? [{ label: tipoLabel, clearHref: serviciosBandejaHref({ vista, q: query, desde, hasta, estado }) }] : []),
          ...(estadoLabel ? [{ label: estadoLabel, clearHref: serviciosBandejaHref({ vista, tipo, q: query, desde, hasta }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: serviciosBandejaHref({ vista, tipo, desde, hasta, estado }) }] : []),
          ...(desde ? [{ label: `Desde ${desde}`, clearHref: serviciosBandejaHref({ vista, tipo, q: query, hasta, estado }) }] : []),
          ...(hasta ? [{ label: `Hasta ${hasta}`, clearHref: serviciosBandejaHref({ vista, tipo, q: query, desde, estado }) }] : []),
        ]}
      />

      {rows.length === 0 ? (
        <Empty
          title={query || desde || hasta ? "Sin coincidencias" : vista === "historial" ? "Sin historial" : "Sin servicios activos"}
          body={
            query || desde || hasta
              ? `Nada coincide con los filtros${tipoLabel ? ` en ${tipoLabel.toLowerCase()}` : ""}.`
              : vista === "historial"
                ? tipoLabel
                  ? `No hay ${tipoLabel.toLowerCase()} en el historial.`
                  : "Aún no hay servicios cerrados o cancelados que mostrar."
                : tipoLabel
                  ? `No hay ${tipoLabel.toLowerCase()} activos en este momento.`
                  : "No hay servicios activos en este momento."
          }
          action={
            query || desde || hasta ? (
              <TextLink href={serviciosBandejaHref({ vista, tipo })}>Quitar filtros</TextLink>
            ) : undefined
          }
        />
      ) : (
        <ServiciosSupervisorList
          rows={rows}
          showTipo={!tipoParam}
          hideAssignee={technician}
          variant={vista === "historial" ? "historial" : "activos"}
        />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
