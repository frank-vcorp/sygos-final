export function shoppingListKindLabel(kind: string) {
  return kind === "REFACCION" ? "Refacciones" : "Generales";
}

export function normalizeShoppingListKind(kind: string | null | undefined) {
  return kind === "REFACCION" ? "REFACCION" : "GENERAL";
}
