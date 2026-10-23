import type { Prisma, PrismaClient } from "@prisma/client";
import { listHref } from "./list-url";

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

export type InventoryStockFilter = "" | "disponible" | "cero" | "bajo_minimo";

const STOCK_FILTERS = new Set<InventoryStockFilter>(["", "disponible", "cero", "bajo_minimo"]);

export function parseInventoryStockFilter(raw: string | undefined, legacyVista?: string): InventoryStockFilter {
  if (legacyVista === "bajo_minimo") return "bajo_minimo";
  const value = (raw ?? "").trim() as InventoryStockFilter;
  return STOCK_FILTERS.has(value) ? value : "";
}

export function inventoryListHref(filters: InventoryListFilters) {
  return listHref("/inventario", {
    q: filters.query?.trim() || undefined,
    familia: filters.family?.trim() || undefined,
    rack: filters.rack?.trim() || undefined,
    existencia: filters.stock || undefined,
  });
}

export type InventoryListFilters = {
  query?: string;
  family?: string;
  rack?: string;
  stock?: InventoryStockFilter;
};

export function inventoryListHasCriteria(filters: InventoryListFilters): boolean {
  if (filters.family?.trim()) return true;
  if (filters.rack?.trim()) return true;
  if (filters.stock) return true;
  return (filters.query?.trim().length ?? 0) >= INVENTORY_SEARCH_MIN_LEN;
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

/** Combina texto libre con familia, rack y existencia (excepto bajo mínimo, que va aparte). */
export function partInventoryListWhere(companyId: string, filters: InventoryListFilters): Prisma.PartWhereInput | null {
  if (!inventoryListHasCriteria(filters) || filters.stock === "bajo_minimo") return null;
  const AND: Prisma.PartWhereInput[] = [];
  const q = filters.query?.trim() ?? "";
  if (q.length >= INVENTORY_SEARCH_MIN_LEN) {
    const text = partInventorySearchWhere(companyId, q);
    if (text?.OR) AND.push({ OR: text.OR });
  }
  const family = filters.family?.trim();
  if (family) AND.push({ family });
  const rack = filters.rack?.trim();
  if (rack) AND.push({ rack });
  if (filters.stock === "cero") AND.push({ qty: 0 });
  if (filters.stock === "disponible") AND.push({ qty: { gt: 0 } });
  return { companyId, active: true, AND };
}

export type InventoryFamilyChip = { family: string; count: number };
export type InventoryRackOption = { rack: string; count: number };

export async function listTopInventoryFamilies(prisma: PrismaClient, companyId: string, limit = 20) {
  const rows = await prisma.$queryRaw<InventoryFamilyChip[]>`
    SELECT family, COUNT(*) AS count
    FROM Part
    WHERE companyId = ${companyId}
      AND active = 1
      AND TRIM(family) != ''
    GROUP BY family
    ORDER BY count DESC, family ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ family: row.family, count: Number(row.count) }));
}

export async function listTopInventoryRacks(prisma: PrismaClient, companyId: string, limit = 16) {
  const rows = await prisma.$queryRaw<InventoryRackOption[]>`
    SELECT rack, COUNT(*) AS count
    FROM Part
    WHERE companyId = ${companyId}
      AND active = 1
      AND TRIM(rack) != ''
    GROUP BY rack
    ORDER BY count DESC, rack ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ rack: row.rack, count: Number(row.count) }));
}

export type InventoryFieldOption = { value: string; count: number };

async function listTopInventoryTextField(
  prisma: PrismaClient,
  companyId: string,
  field: "nivel" | "unit" | "mountType" | "catalogNumero",
  limit: number,
) {
  const rows =
    field === "nivel"
      ? await prisma.$queryRaw<InventoryFieldOption[]>`
          SELECT nivel AS value, COUNT(*) AS count
          FROM Part
          WHERE companyId = ${companyId} AND active = 1 AND TRIM(nivel) != ''
          GROUP BY nivel
          ORDER BY count DESC, value ASC
          LIMIT ${limit}
        `
      : field === "unit"
        ? await prisma.$queryRaw<InventoryFieldOption[]>`
            SELECT unit AS value, COUNT(*) AS count
            FROM Part
            WHERE companyId = ${companyId} AND active = 1 AND TRIM(unit) != ''
            GROUP BY unit
            ORDER BY count DESC, value ASC
            LIMIT ${limit}
          `
        : field === "mountType"
          ? await prisma.$queryRaw<InventoryFieldOption[]>`
              SELECT mountType AS value, COUNT(*) AS count
              FROM Part
              WHERE companyId = ${companyId} AND active = 1 AND TRIM(mountType) != ''
              GROUP BY mountType
              ORDER BY count DESC, value ASC
              LIMIT ${limit}
            `
          : await prisma.$queryRaw<InventoryFieldOption[]>`
              SELECT catalogNumero AS value, COUNT(*) AS count
              FROM Part
              WHERE companyId = ${companyId} AND active = 1 AND TRIM(catalogNumero) != ''
              GROUP BY catalogNumero
              ORDER BY count DESC, value ASC
              LIMIT ${limit}
            `;
  return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
}

export async function loadInventoryCreateCatalog(prisma: PrismaClient, companyId: string) {
  const [families, racks, niveles, units, mountTypes, catalogNumeros] = await Promise.all([
    listTopInventoryFamilies(prisma, companyId, 80),
    listTopInventoryRacks(prisma, companyId, 40),
    listTopInventoryTextField(prisma, companyId, "nivel", 40),
    listTopInventoryTextField(prisma, companyId, "unit", 24),
    listTopInventoryTextField(prisma, companyId, "mountType", 24),
    listTopInventoryTextField(prisma, companyId, "catalogNumero", 60),
  ]);
  return { families, racks, niveles, units, mountTypes, catalogNumeros };
}

export async function fetchInventoryPartsForList(
  prisma: PrismaClient,
  companyId: string,
  filters: InventoryListFilters,
  limit = INVENTORY_SEARCH_LIMIT,
) {
  const stock = filters.stock ?? "";
  if (stock === "bajo_minimo") {
    const family = filters.family?.trim();
    const ids = family
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM Part
          WHERE companyId = ${companyId}
            AND active = 1
            AND minQty IS NOT NULL
            AND qty < minQty
            AND family = ${family}
          ORDER BY qty ASC
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM Part
          WHERE companyId = ${companyId}
            AND active = 1
            AND minQty IS NOT NULL
            AND qty < minQty
          ORDER BY qty ASC
          LIMIT ${limit}
        `;
    if (ids.length === 0) return [];
    const parts = await prisma.part.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      orderBy: [{ qty: "asc" }, { partNumber: "asc" }],
    });
    return applyStockFilter(parts, stock);
  }

  const where = partInventoryListWhere(companyId, filters);
  if (!where) return [];
  const oversample = stock === "disponible" || stock === "cero" ? limit + 120 : limit;
  const parts = await prisma.part.findMany({
    where,
    orderBy: [{ partNumber: "asc" }, { rack: "asc" }, { nivel: "asc" }],
    take: oversample,
  });
  return applyStockFilter(parts, stock).slice(0, limit);
}

function applyStockFilter<T extends { qty: number; qtyReserved: number }>(parts: T[], stock: InventoryStockFilter) {
  if (stock === "disponible") return parts.filter((part) => partInventoryAvailableQty(part) > 0);
  if (stock === "cero") return parts.filter((part) => partInventoryAvailableQty(part) === 0);
  return parts;
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
