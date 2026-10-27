export function shoppingListKindLabel(kind: string) {
  return kind === "REFACCION" ? "Refacciones" : "Generales";
}

export function normalizeShoppingListKind(kind: string | null | undefined) {
  return kind === "REFACCION" ? "REFACCION" : "GENERAL";
}

/** Listas creadas antes de `ShoppingList.kind` o con mezcla se resuelven por partidas. */
export function shoppingListKindFromList(list: {
  kind: string;
  lines?: Array<{ requirement: { kind: string } }>;
}) {
  if (list.lines?.length) {
    const kinds = list.lines.map((line) => normalizeShoppingListKind(line.requirement.kind));
    if (kinds.every((kind) => kind === "REFACCION")) return "REFACCION";
    if (kinds.every((kind) => kind === "GENERAL")) return "GENERAL";
  }
  return normalizeShoppingListKind(list.kind);
}
