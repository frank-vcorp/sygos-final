import { prisma } from "./db";
import { catalogKey } from "./catalog-key";

export async function rememberCatalog(type: string, brand: string, model: string) {
  const typeName = type.trim();
  const brandName = brand.trim();
  const modelName = model.trim();
  if (!typeName || !brandName || !modelName) throw new Error("Tipo, marca y modelo son obligatorios.");
  const typeRow = await prisma.catalogType.upsert({
    where: { key: catalogKey(typeName) },
    update: {},
    create: { name: typeName, key: catalogKey(typeName) },
  });
  const brandRow = await prisma.catalogBrand.upsert({
    where: { key: catalogKey(brandName) },
    update: {},
    create: { name: brandName, key: catalogKey(brandName) },
  });
  const modelRow = await prisma.catalogModel.upsert({
    where: { typeId_brandId_key: { typeId: typeRow.id, brandId: brandRow.id, key: catalogKey(modelName) } },
    update: {},
    create: { typeId: typeRow.id, brandId: brandRow.id, name: modelName, key: catalogKey(modelName) },
  });
  return { typeName: typeRow.name, brandName: brandRow.name, modelName: modelRow.name };
}
