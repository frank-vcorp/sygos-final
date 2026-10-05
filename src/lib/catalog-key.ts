/** Shared key so "Fanuc", "FANUC" and "A06B-6127-H110" / "A06B6127H110" match. Slash and dot stay significant. */
export function catalogKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212_-]/g, "");
}
