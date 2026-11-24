import catalogJson from "@/data/sat-clave-prodserv-subset.json";
import { catalogKey } from "@/lib/catalog-key";

export const SAT_PRODSERV_SEARCH_MIN_LEN = 2;
export const SAT_PRODSERV_AUTOCOMPLETE_LIMIT = 12;

export type SatProdServEntry = {
  key: string;
  description: string;
};

const catalog = catalogJson as SatProdServEntry[];

export function searchSatProdServ(query: string, limit = SAT_PRODSERV_AUTOCOMPLETE_LIMIT): SatProdServEntry[] {
  const trimmed = query.trim();
  if (trimmed.length < SAT_PRODSERV_SEARCH_MIN_LEN) return [];
  const key = catalogKey(trimmed);
  const digits = trimmed.replace(/\D/g, "");
  return catalog
    .filter((row) => {
      if (digits.length >= SAT_PRODSERV_SEARCH_MIN_LEN && row.key.includes(digits)) return true;
      return catalogKey(row.description).includes(key) || catalogKey(row.key).includes(key);
    })
    .slice(0, Math.max(1, limit));
}

export function satProdServLabel(entry: SatProdServEntry): string {
  return `${entry.key} — ${entry.description}`;
}