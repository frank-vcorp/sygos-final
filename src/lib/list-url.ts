/** Construye URL de listado conservando solo parámetros con valor. */
export function listHref(path: string, params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Quita un parámetro de búsqueda (p. ej. chip «×» en filtros activos). */
export function listHrefWithout(
  path: string,
  current: Record<string, string | undefined>,
  omitKey: string,
): string {
  const next: Record<string, string | undefined> = { ...current };
  delete next[omitKey];
  return listHref(path, next);
}
