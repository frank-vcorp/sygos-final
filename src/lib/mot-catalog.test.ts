import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("catálogo MOT separado de EQUI", () => {
  it("el alta de motor no lista marcas ni tipos de equipo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-mot-cat-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { rememberCatalog, loadEquipmentCatalogByKind } = await import("./catalog");
    await rememberCatalog("AMPLIFICADOR", "FANUC", "A06B-6079-H208", "EQUI");
    const catalog = await loadEquipmentCatalogByKind();
    assert.equal(catalog.MOT.types.includes("AMPLIFICADOR"), false);
    assert.equal(catalog.MOT.brands.includes("FANUC"), false);
    assert.equal(catalog.MOT.models.some((row) => row.brand === "FANUC"), false);
    assert.equal(catalog.EQUI.types.includes("AMPLIFICADOR"), true);
    assert.equal(catalog.EQUI.brands.includes("FANUC"), true);
    assert.ok(catalog.MOT.types.includes("SERVOMOTOR"));
    assert.ok(catalog.MOT.brands.includes("SEW"));
    assert.equal(catalog.EQUI.types.includes("SERVOMOTOR"), false);
    assert.equal(catalog.EQUI.brands.includes("SEW"), false);
  });
});
