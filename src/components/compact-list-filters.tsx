"use client";

import type { ReactNode } from "react";
import { CompactFilterBar, useAutoFilters } from "@/components/auto-filter-bar";
import { controlClass, Field } from "@/components/ui";
import { listHref } from "@/lib/list-url";

function useListFilters<T extends Record<string, string>>(
  path: string,
  initialFilters: T,
  toParams: (filters: T) => Record<string, string | undefined>,
  debouncedKeys: Array<keyof T> = ["q"],
) {
  return useAutoFilters({
    initialFilters,
    toHref: (filters) => listHref(path, toParams(filters)),
    debouncedKeys,
  });
}

export function BillingVistaFilter({ vista, options }: { vista: string; options: Array<{ value: string; label: string }> }) {
  const { filters, update, apply } = useListFilters(
    "/facturacion",
    { vista },
    (f) => ({ vista: f.vista === "todas" ? undefined : f.vista }),
    [],
  );
  return (
    <CompactFilterBar onSubmit={apply}>
      <select name="vista" value={filters.vista} aria-label="Vista de facturación" className={`${controlClass} sm:w-[190px]`} onChange={(event) => update("vista", event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </CompactFilterBar>
  );
}

export function CobranzaVistaFilter({ vista }: { vista: string }) {
  const { filters, update, apply } = useListFilters(
    "/cobranza",
    { vista },
    (f) => ({ vista: f.vista === "todas" ? undefined : f.vista }),
    [],
  );
  return (
    <CompactFilterBar onSubmit={apply}>
      <select name="vista" value={filters.vista} aria-label="Vista de cobranza" className={`${controlClass} sm:w-[190px]`} onChange={(event) => update("vista", event.target.value)}>
        <option value="todas">Todas</option>
        <option value="cxc">Con saldo</option>
        <option value="vencidas">Vencidas</option>
      </select>
    </CompactFilterBar>
  );
}

export function VentasListFilter({ vista, q }: { vista: string; q: string }) {
  const { filters, update, apply } = useListFilters("/ventas", { vista, q }, (f) => ({
    vista: f.vista === "todas" ? undefined : f.vista,
    q: f.q.trim() || undefined,
  }));
  return (
    <CompactFilterBar onSubmit={apply}>
      <select name="vista" value={filters.vista} aria-label="Vista de ventas" className={`${controlClass} sm:w-[190px]`} onChange={(event) => update("vista", event.target.value)}>
        <option value="todas">Todas</option>
        <option value="pendientes">Requieren atención</option>
        <option value="al_dia">Al día</option>
      </select>
      <input name="q" value={filters.q} placeholder="Folio, cliente o cotización" className={`${controlClass} sm:flex-1`} onChange={(event) => update("q", event.target.value)} />
    </CompactFilterBar>
  );
}

export function CotizacionesListFilter({ vista, q }: { vista: string; q: string }) {
  const { filters, update, apply } = useListFilters("/cotizaciones", { vista, q }, (f) => ({
    vista: f.vista === "todas" ? undefined : f.vista,
    q: f.q.trim() || undefined,
  }));
  return (
    <CompactFilterBar onSubmit={apply}>
      <select name="vista" value={filters.vista} aria-label="Vista de cotizaciones" className={`${controlClass} sm:w-[190px]`} onChange={(event) => update("vista", event.target.value)}>
        <option value="todas">Todas</option>
        <option value="pendientes">Sin precio</option>
        <option value="decision">Esperan respuesta</option>
      </select>
      <input name="q" value={filters.q} placeholder="Buscar por folio o cliente" className={`${controlClass} sm:flex-1`} onChange={(event) => update("q", event.target.value)} />
    </CompactFilterBar>
  );
}

export function ProveedoresListFilter({ q, estado }: { q: string; estado: string }) {
  const { filters, update, apply } = useListFilters("/proveedores", { q, estado }, (f) => ({
    q: f.q.trim() || undefined,
    estado: f.estado === "activos" ? undefined : f.estado,
  }));
  return (
    <CompactFilterBar onSubmit={apply}>
      <input name="q" value={filters.q} placeholder="Nombre o razón social" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} onChange={(event) => update("q", event.target.value)} />
      <select name="estado" value={filters.estado} className={`${controlClass} sm:w-auto`} onChange={(event) => update("estado", event.target.value)}>
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
      </select>
    </CompactFilterBar>
  );
}

export function ProspectosListFilter({ q, estado }: { q: string; estado: string }) {
  const { filters, update, apply } = useListFilters("/prospectos", { q, estado }, (f) => ({
    q: f.q.trim() || undefined,
    estado: f.estado === "ABIERTOS" ? undefined : f.estado,
  }));
  return (
    <CompactFilterBar onSubmit={apply}>
      <input name="q" value={filters.q} placeholder="Empresa o nombre" className={`${controlClass} sm:flex-1`} onChange={(event) => update("q", event.target.value)} />
      <select name="estado" value={filters.estado} className={`${controlClass} sm:w-auto`} onChange={(event) => update("estado", event.target.value)}>
        <option value="ABIERTOS">Abiertos</option>
        <option value="NUEVO">Nuevo</option>
        <option value="EN_SEGUIMIENTO">En seguimiento</option>
        <option value="CONVERTIDO">Convertido</option>
        <option value="DESCARTADO">Descartado</option>
      </select>
    </CompactFilterBar>
  );
}

export function EquiposQueryFilter({ q }: { q: string }) {
  const { filters, update, apply } = useListFilters("/equipos", { q }, (f) => ({ q: f.q.trim() || undefined }));
  return (
    <CompactFilterBar onSubmit={apply}>
      <input name="q" value={filters.q} placeholder="Folio, modelo, serie o cliente" className={`${controlClass} sm:flex-1`} onChange={(event) => update("q", event.target.value)} />
    </CompactFilterBar>
  );
}

export function FinanzasMesFilter({ mes, vista }: { mes: string; vista: string }) {
  const { filters, update, apply } = useListFilters(
    "/finanzas",
    { mes, vista },
    (f) => ({
      mes: f.mes || undefined,
      vista: f.vista || undefined,
    }),
    [],
  );
  return (
    <CompactFilterBar onSubmit={apply}>
      <Field label="Mes del resumen" className="sm:w-auto">
        <input name="mes" type="month" value={filters.mes} className={`${controlClass} sm:w-auto`} onChange={(event) => update("mes", event.target.value)} />
      </Field>
    </CompactFilterBar>
  );
}

export function ListHrefFilterBar<T extends Record<string, string>>({
  path,
  initialFilters,
  toParams,
  debouncedKeys = ["q"],
  className,
  children,
}: {
  path: string;
  initialFilters: T;
  toParams: (filters: T) => Record<string, string | undefined>;
  debouncedKeys?: Array<keyof T>;
  className?: string;
  children: (ctx: { filters: T; update: <K extends keyof T>(key: K, value: T[K]) => void }) => ReactNode;
}) {
  const { filters, update, apply } = useListFilters(path, initialFilters, toParams, debouncedKeys);
  return (
    <CompactFilterBar onSubmit={apply} className={className}>
      {children({ filters, update })}
    </CompactFilterBar>
  );
}
