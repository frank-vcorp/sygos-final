import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it } from "node:test";

describe("folios", () => {
  it("numera por empresa y comparte solo MOT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-folio-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { PrismaClient } = await import("@prisma/client");
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const prisma = new PrismaClient();
    const { allocateFolio } = await import("./folios");
    const a = await prisma.company.create({ data: { code: "A", name: "A" } });
    const b = await prisma.company.create({ data: { code: "B", name: "B" } });
    assert.equal(await allocateFolio(a.id, "COT"), "COT-1");
    assert.equal(await allocateFolio(a.id, "COT"), "COT-2");
    assert.equal(await allocateFolio(b.id, "COT"), "COT-1");
    assert.equal(await allocateFolio(a.id, "MOT"), "MOT-1");
    assert.equal(await allocateFolio(b.id, "MOT"), "MOT-2");
    await prisma.$disconnect();
  });
});
