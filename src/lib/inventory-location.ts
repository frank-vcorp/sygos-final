/** Ubicación del Excel: casi siempre "Rack 2 Nivel 6"; excepciones van completas en rack. */
export function parseUbicacion(ubicacion: string): { rack: string; nivel: string } {
  const trimmed = ubicacion.trim();
  if (!trimmed) return { rack: "", nivel: "" };
  const match = /^Rack\s+(\d+)\s+Nivel\s+(\d+)$/i.exec(trimmed);
  if (match) return { rack: match[1], nivel: match[2] };
  return { rack: trimmed, nivel: "" };
}

export function formatUbicacion(rack: string, nivel: string): string {
  const r = rack.trim();
  const n = nivel.trim();
  if (!r) return "";
  if (n && /^\d+$/.test(r) && /^\d+$/.test(n)) return `Rack ${r} Nivel ${n}`;
  if (n) return `${r} · ${n}`;
  return r;
}
