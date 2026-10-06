import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { bindSandbox, isParticipant, sandboxBound } from "./db";

describe("modo de pruebas", () => {
  it("incluye al usuario o al rol elegido y a nadie más", () => {
    const meta = { active: true, userIds: ["u1"], roles: ["VENTAS"] };
    assert.equal(isParticipant(meta, "u1", "TECNICO"), true);
    assert.equal(isParticipant(meta, "u2", "VENTAS"), true);
    assert.equal(isParticipant(meta, "u2", "TECNICO"), false);
    assert.equal(isParticipant({ ...meta, active: false }, "u1", "VENTAS"), false);
  });

  it("la copia usa otro archivo y el contexto sobrevive al await", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-sandbox-"));
    const prod = new PrismaClient({ datasourceUrl: `file:${join(dir, "prod.db")}` });
    const copy = new PrismaClient({ datasourceUrl: `file:${join(dir, "copy.db")}` });
    await prod.$executeRawUnsafe("CREATE TABLE probe (name TEXT)");
    await copy.$executeRawUnsafe("CREATE TABLE probe (name TEXT)");
    await prod.$executeRawUnsafe("INSERT INTO probe VALUES ('real')");
    await copy.$executeRawUnsafe("INSERT INTO probe VALUES ('prueba')");
    const real = await prod.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM probe");
    const trial = await copy.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM probe");
    assert.deepEqual(real.map((row) => row.name), ["real"]);
    assert.deepEqual(trial.map((row) => row.name), ["prueba"]);
    await prod.$disconnect();
    await copy.$disconnect();
    bindSandbox(true);
    await Promise.resolve();
    assert.equal(sandboxBound(), true);
    bindSandbox(false);
    assert.equal(sandboxBound(), false);
  });
});
