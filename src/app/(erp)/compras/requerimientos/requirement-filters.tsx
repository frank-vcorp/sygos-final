"use client";

import { CompactFilterBar, useAutoFilters } from "@/components/auto-filter-bar";
import { controlClass } from "@/components/ui";
import { requirementListHref, type RequirementStatus } from "@/lib/requirement-filters";

type RequirementFilterValues = {
  estado: RequirementStatus;
  solicitante: string;
  fecha: string;
};

export function RequirementFilters({
  estado,
  solicitante,
  fecha,
  requesters,
  canFilterRequester,
}: RequirementFilterValues & {
  requesters: Array<{ id: string; name: string }>;
  canFilterRequester: boolean;
}) {
  const initialFilters = { estado, solicitante, fecha };
  const { filters, update, apply } = useAutoFilters({
    initialFilters,
    toHref: requirementListHref,
    debouncedKeys: ["solicitante"],
  });

  return (
    <CompactFilterBar onSubmit={apply}>
      <select
        aria-label="Estado"
        className={`${controlClass} sm:w-auto`}
        name="estado"
        value={filters.estado}
        onChange={(event) => update("estado", event.target.value as RequirementStatus)}
      >
        <option value="PENDIENTE">Pendientes</option>
        <option value="EN_LISTA">En lista</option>
        <option value="ATENDIDO">Atendidos</option>
        <option value="CANCELADO">Cancelados</option>
      </select>
      {canFilterRequester ? (
        <select
          aria-label="Solicitante"
          className={`${controlClass} sm:min-w-[12rem] sm:flex-1`}
          name="solicitante"
          value={filters.solicitante}
          onChange={(event) => update("solicitante", event.target.value)}
        >
          <option value="">Todos los solicitantes</option>
          {requesters.map((requester) => <option key={requester.id} value={requester.id}>{requester.name}</option>)}
        </select>
      ) : null}
      <input
        aria-label="Fecha"
        className={`${controlClass} sm:w-auto`}
        name="fecha"
        type="date"
        value={filters.fecha}
        onChange={(event) => update("fecha", event.target.value)}
      />
    </CompactFilterBar>
  );
}
