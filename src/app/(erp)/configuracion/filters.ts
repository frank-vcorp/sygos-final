export type EstadoFiltro = "todos" | "activos" | "inactivos";

export function readEstado(value: string | undefined): EstadoFiltro {
  if (value === "activos" || value === "inactivos") return value;
  return "todos";
}

export function matchesEstado(active: boolean, estado: EstadoFiltro) {
  if (estado === "activos") return active;
  if (estado === "inactivos") return !active;
  return true;
}

export function matchesText(query: string, parts: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => (part ?? "").toLowerCase().includes(needle));
}
