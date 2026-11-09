import { prisma } from "./db";
import { catalogKey } from "./catalog-key";
import { MOTOR_CATALOG_SEED } from "./motor-catalog-seed";

export { MOTOR_CATALOG_SEED };

export type EquipmentKind = "EQUI" | "MOT";

export type EquipmentCatalogSlice = {
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
};

export type EquipmentCatalogByKind = Record<EquipmentKind, EquipmentCatalogSlice>;

export async function rememberCatalog(type: string, brand: string, model: string, equipmentKind: EquipmentKind = "EQUI") {
  const typeName = type.trim();
  const brandName = brand.trim();
  const modelName = model.trim();
  if (!typeName || !brandName || !modelName) throw new Error("Tipo, marca y modelo son obligatorios.");
  const typeRow = await prisma.catalogType.upsert({
    where: { key_equipmentKind: { key: catalogKey(typeName), equipmentKind } },
    update: {},
    create: { name: typeName, key: catalogKey(typeName), equipmentKind },
  });
  const brandRow = await prisma.catalogBrand.upsert({
    where: { key_equipmentKind: { key: catalogKey(brandName), equipmentKind } },
    update: {},
    create: { name: brandName, key: catalogKey(brandName), equipmentKind },
  });
  const modelRow = await prisma.catalogModel.upsert({
    where: { typeId_brandId_key: { typeId: typeRow.id, brandId: brandRow.id, key: catalogKey(modelName) } },
    update: { equipmentKind },
    create: { typeId: typeRow.id, brandId: brandRow.id, name: modelName, key: catalogKey(modelName), equipmentKind },
  });
  return { typeName: typeRow.name, brandName: brandRow.name, modelName: modelRow.name };
}

export async function ensureMotorCatalog() {
  for (const row of MOTOR_CATALOG_SEED) {
    await rememberCatalog(row.type, row.brand, row.model, "MOT");
  }
}

export async function loadEquipmentCatalogByKind(): Promise<EquipmentCatalogByKind> {
  await ensureMotorCatalog();
  const [types, brands, models] = await Promise.all([
    prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
    prisma.catalogModel.findMany({ include: { type: true, brand: true }, orderBy: { name: "asc" } }),
  ]);
  function slice(kind: EquipmentKind): EquipmentCatalogSlice {
    return {
      types: types.filter((row) => row.equipmentKind === kind).map((row) => row.name),
      brands: brands.filter((row) => row.equipmentKind === kind).map((row) => row.name),
      models: models
        .filter((row) => row.equipmentKind === kind)
        .map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name })),
    };
  }
  return { EQUI: slice("EQUI"), MOT: slice("MOT") };
}
