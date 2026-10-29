export function isLinkActive(
  pathname: string,
  search: URLSearchParams,
  href: string,
  locationHash: string,
): boolean {
  const hashIdx = href.indexOf("#");
  const wantHash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const pathQuery = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const [path, queryString] = pathQuery.split("?", 2);
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (wantHash) return locationHash === wantHash;
  if (!queryString) {
    if (pathname !== path) return pathname.startsWith(`${path}/`);
    return !search.get("vista");
  }
  const expected = new URLSearchParams(queryString.split("#")[0] ?? queryString);
  for (const [key, value] of expected.entries()) {
    if (search.get(key) !== value) return false;
  }
  return true;
}

/** Longest matching nav href wins across the whole sidebar. */
export function pickGlobalActiveNavHref(
  pathname: string,
  search: URLSearchParams,
  hrefs: string[],
  locationHash: string,
): string | undefined {
  return hrefs
    .filter((href) => isLinkActive(pathname, search, href, locationHash))
    .sort((a, b) => b.length - a.length)[0];
}
