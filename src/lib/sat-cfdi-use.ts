import catalog from "./sat/c_UsoCFDI.json";

type SatUsoCfdi = {
  id: string;
  descripcion: string;
  fechaDeFinDeVigencia: string;
};

/** Catálogo c_UsoCFDI del SAT para CFDI 4.0. */
export const SAT_USO_CFDI: SatUsoCfdi[] = (catalog as SatUsoCfdi[]).filter((row) => !row.fechaDeFinDeVigencia);

const codes = new Set(SAT_USO_CFDI.map((row) => row.id));

export function cfdiUseLabel(code: string | null | undefined): string {
  if (!code) return "Sin definir";
  const row = SAT_USO_CFDI.find((item) => item.id === code);
  return row ? `${row.id} — ${row.descripcion}` : code;
}

export function parseCfdiUse(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (!codes.has(code)) throw new Error("El uso de CFDI debe elegirse del catálogo del SAT.");
  return code;
}
