-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "equipmentKind" TEXT NOT NULL DEFAULT 'EQUI'
);
INSERT INTO "new_CatalogType" ("id", "name", "key", "equipmentKind") SELECT "id", "name", "key", 'EQUI' FROM "CatalogType";
DROP TABLE "CatalogType";
ALTER TABLE "new_CatalogType" RENAME TO "CatalogType";
CREATE UNIQUE INDEX "CatalogType_key_equipmentKind_key" ON "CatalogType"("key", "equipmentKind");
CREATE TABLE "new_CatalogBrand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "equipmentKind" TEXT NOT NULL DEFAULT 'EQUI'
);
INSERT INTO "new_CatalogBrand" ("id", "name", "key", "equipmentKind") SELECT "id", "name", "key", 'EQUI' FROM "CatalogBrand";
DROP TABLE "CatalogBrand";
ALTER TABLE "new_CatalogBrand" RENAME TO "CatalogBrand";
CREATE UNIQUE INDEX "CatalogBrand_key_equipmentKind_key" ON "CatalogBrand"("key", "equipmentKind");
CREATE TABLE "new_CatalogModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "equipmentKind" TEXT NOT NULL DEFAULT 'EQUI',
    CONSTRAINT "CatalogModel_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CatalogType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CatalogModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "CatalogBrand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CatalogModel" ("id", "typeId", "brandId", "name", "key", "equipmentKind") SELECT "id", "typeId", "brandId", "name", "key", 'EQUI' FROM "CatalogModel";
DROP TABLE "CatalogModel";
ALTER TABLE "new_CatalogModel" RENAME TO "CatalogModel";
CREATE UNIQUE INDEX "CatalogModel_typeId_brandId_key_key" ON "CatalogModel"("typeId", "brandId", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
