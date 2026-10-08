const PREVIEW_LIMIT = 100;
const SEARCH_LIMIT = 300;

export function clientMatchesQuery(name: string, rfc: string | null, query: string) {
  const needle = query.trim().toLocaleLowerCase("es-MX");
  if (!needle) return true;
  if (name.toLocaleLowerCase("es-MX").includes(needle)) return true;
  if (rfc?.toLocaleLowerCase("es-MX").includes(needle)) return true;
  return false;
}

export { PREVIEW_LIMIT, SEARCH_LIMIT };
