import type { Prisma, PrismaClient } from "@prisma/client";

export const INVENTORY_SEARCH_MIN_LEN = 2;
export const INVENTORY_SEARCH_LIMIT = 80;
export const INVENTORY_AUTOCOMPLETE_LIMIT = 20;

export function partInventoryAvailableQty(part: { qty: number; qtyReserved: number }) {
  return Math.max(0, part.qty - part.qtyReserved);
}

export function normalizeInventorySearch(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPartSearchKey(fields: {
  partNumber: string;
  description?: string | null;
  catalogNumero?: string | null;
  family?: string | null;
  rack?: string | null;
  nivel?: string | null;
  mountType?: string | null;
}) {
  return normalizeInventorySearch(
    [
      fields.partNumber,
      fields.description,
      fields.catalogNumero,
      fields.family,
      fields.rack,
      fields.nivel,
      fields.mountType,
    ]
      .filter((value) => value != null && String(value).trim() !== "")
      .join(" "),
  );
}

/** Filtro Prisma para buscar refacciones (sin acentos vía searchKey). */
export function partInventorySearchWhere(companyId: string, query: string): Prisma.PartWhereInput | null {
  const q = query.trim();
  if (q.length < INVENTORY_SEARCH_MIN_LEN) return null;
  const needle = normalizeInventorySearch(q);
  const contains = { contains: q };
  const keyContains = { contains: needle };
  return {
    companyId,
    active: true,
    OR: [
      { searchKey: keyContains },
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

export type InventorySearchHit = {
  id: string;
  partNumber: string;
  description: string;
  family: string;
  catalogNumero: string;
  rack: string;
  nivel: string;
  qty: number;
  qtyReserved: number;
  available: number;
};

export async function searchInventoryParts(
  prisma: PrismaClient,
  companyId: string,
  query: string,
  limit = INVENTORY_AUTOCOMPLETE_LIMIT,
): Promise<InventorySearchHit[]> {
  const where = partInventorySearchWhere(companyId, query);
  if (!where) return [];
  const rows = await prisma.part.findMany({
    where,
    orderBy: [{ partNumber: "asc" }, { rack: "asc" }, { nivel: "asc" }],
    take: limit,
    select: {
      id: true,
      partNumber: true,
      description: true,
      family: true,
      catalogNumero: true,
      rack: true,
      nivel: true,
      qty: true,
      qtyReserved: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    available: partInventoryAvailableQty(row),
  }));
}

export async function backfillPartSearchKeys(prisma: PrismaClient, companyId?: string) {
  const where: Prisma.PartWhereInput = companyId ? { companyId } : {};
  const rows = await prisma.part.findMany({
    where,
    select: {
      id: true,
      partNumber: true,
      description: true,
      catalogNumero: true,
      family: true,
      rack: true,
      nivel: true,
      mountType: true,
      searchKey: true,
    },
  });
  let updated = 0;
  for (const row of rows) {
    const searchKey = buildPartSearchKey(row);
    if (row.searchKey === searchKey) continue;
    await prisma.part.update({ where: { id: row.id }, data: { searchKey } });
    updated += 1;
  }
  return { scanned: rows.length, updated };
}
