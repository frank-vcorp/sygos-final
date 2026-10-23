import type { Prisma } from "@prisma/client";

export const INVENTORY_SEARCH_MIN_LEN = 2;
export const INVENTORY_SEARCH_LIMIT = 80;

/** Filtro Prisma para buscar refacciones por texto en los campos que usa almacén. */
export function partInventorySearchWhere(companyId: string, query: string): Prisma.PartWhereInput | null {
  const q = query.trim();
  if (q.length < INVENTORY_SEARCH_MIN_LEN) return null;
  const contains = { contains: q };
  return {
    companyId,
    active: true,
    OR: [
      { partNumber: contains },
      { description: contains },
      { family: contains },
      { catalogNumero: contains },
      { rack: contains },
      { nivel: contains },
      { mountType: contains },
    ],
  };
}

export function partInventoryAvailableQty(part: { qty: number; qtyReserved: number }) {
  return Math.max(0, part.qty - part.qtyReserved);
}
