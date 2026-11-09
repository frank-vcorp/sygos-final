-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Priority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "attentionType" TEXT NOT NULL,
    "equipmentKind" TEXT NOT NULL DEFAULT 'EQUI',
    "name" TEXT NOT NULL,
    "price" REAL,
    "incrementPct" REAL,
    "targetMinDays" INTEGER,
    "targetMaxDays" INTEGER,
    "slaMaxDays" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Priority_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Priority" ("id", "companyId", "attentionType", "equipmentKind", "name", "price", "incrementPct", "targetMinDays", "targetMaxDays", "slaMaxDays", "sortOrder", "active")
SELECT
    "id",
    "companyId",
    "attentionType",
    CASE
        WHEN "attentionType" = 'DIAGNOSTICO' AND "companyId" IN (SELECT "id" FROM "Company" WHERE "code" = 'SERVOMOTORES') THEN 'MOT'
        ELSE 'EQUI'
    END,
    "name",
    "price",
    "incrementPct",
    "targetMinDays",
    "targetMaxDays",
    "slaMaxDays",
    "sortOrder",
    "active"
FROM "Priority";
DROP TABLE "Priority";
ALTER TABLE "new_Priority" RENAME TO "Priority";
CREATE UNIQUE INDEX "Priority_companyId_attentionType_name_equipmentKind_key" ON "Priority"("companyId", "attentionType", "name", "equipmentKind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
