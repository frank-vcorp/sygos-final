import {
  ActionLink,
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
      <SegmentedNav
        items={[
          {
            href: serviciosBandejaHref({ ...navBase, tipo: "todos" }),
            label: "Todos los tipos",
            active: !tipo || tipo === "todos",
          },
          ...SERVICIO_TIPO_OPTIONS.map((opt) => ({
            href: serviciosBandejaHref({ ...navBase, tipo: opt.param }),
            label: opt.label,
            active: tipo === opt.param,
          })),
        ]}
      />
      <FilterBar action={formAction}>
        {tipo && tipo !== "todos" ? <input type="hidden" name="tipo" value={tipo} /> : null}
        <input name="q" defaultValue={query} placeholder="Folio, cliente, equipo o falla" className={`${controlClass} min-w-0 sm:flex-1`} />
        <input
          type="date"
          name="desde"
          defaultValue={desde ?? ""}
          aria-label="Desde"
          className={`${controlClass} w-full sm:w-auto`}
        />
        <input
          type="date"
          name="hasta"
          defaultValue={hasta ?? ""}
          aria-label="Hasta"
          className={`${controlClass} w-full sm:w-auto`}
        />
        {vista === "historial" ? (
          <select name="estado" defaultValue={estado && estado !== "todos" ? estado : "todos"} className={controlClass}>
            {HISTORIAL_ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>

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
