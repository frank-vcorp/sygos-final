"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { controlClass } from "@/components/ui";
import { requirementListHref, type RequirementStatus } from "@/lib/requirement-filters";

type RequirementFilterValues = {
  estado: RequirementStatus;
  solicitante: string;
  fecha: string;
};

export function RequirementFilters({ estado, solicitante, fecha }: RequirementFilterValues) {
  const router = useRouter();
  const [filters, setFilters] = useState<RequirementFilterValues>({ estado, solicitante, fecha });
  const skipDebounce = useRef(false);

  useEffect(() => {
    setFilters({ estado, solicitante, fecha });
  }, [estado, solicitante, fecha]);

  function navigate(next: RequirementFilterValues) {
    router.replace(requirementListHref(next));
  }

  function update<K extends keyof RequirementFilterValues>(key: K, value: RequirementFilterValues[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key !== "solicitante") {
      navigate(next);
    }
  }

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    if (filters.solicitante.trim() === solicitante.trim()) return;
    const timer = window.setTimeout(() => navigate(filters), 350);
    return () => window.clearTimeout(timer);
  }, [filters, solicitante]);

  return (
    <form
      className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white p-3 shadow-[0_4px_14px_rgba(20,45,75,0.04)] sm:flex-row sm:flex-wrap sm:items-center"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        skipDebounce.current = true;
        navigate(filters);
      }}
    >
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
      <input
        aria-label="Solicitante"
        className={`${controlClass} sm:min-w-[12rem] sm:flex-1`}
        name="solicitante"
        placeholder="Solicitante"
        value={filters.solicitante}
        onChange={(event) => update("solicitante", event.target.value)}
      />
      <input
        aria-label="Fecha"
        className={`${controlClass} sm:w-auto`}
        name="fecha"
        type="date"
        value={filters.fecha}
        onChange={(event) => update("fecha", event.target.value)}
      />
    </form>
  );
}
