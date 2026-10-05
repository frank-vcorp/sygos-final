import catalog from "./sat/c_RegimenFiscal.json";

type SatRegimen = {
  id: string;
  descripcion: string;
  fisica: string;
  moral: string;
  fechaDeInicioDeVigencia: string;
  fechaDeFinDeVigencia: string;
};

/** Catálogo c_RegimenFiscal del SAT para CFDI 4.0. Solo claves vigentes. */
export const SAT_REGIMENES: SatRegimen[] = (catalog as SatRegimen[]).filter((row) => !row.fechaDeFinDeVigencia);

const codes = new Set(SAT_REGIMENES.map((row) => row.id));

export function regimenLabel(code: string | null | undefined): string {
  if (!code) return "Sin definir";
  const row = SAT_REGIMENES.find((item) => item.id === code);
  return row ? `${row.id} — ${row.descripcion}` : code;
}

export function parseRegimen(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (!code) return null;
  if (!codes.has(code)) throw new Error("El régimen fiscal debe elegirse del catálogo del SAT.");
  return code;
}
