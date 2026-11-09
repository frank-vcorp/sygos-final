import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("resolveGerenteServomotoresAssignee", () => {
  it("prefiere gerente activo y asigna al crear MOT", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sygos-sm-auto-"));
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
    const { execSync } = await import("child_process");
    execSync("npx prisma db push --skip-generate", {
      cwd: join(import.meta.dirname, "../.."),
      env: process.env,
      stdio: "ignore",
    });
    const { prisma } = await import("./db");
    const {
      applyMotServomotoresAutoIngreso,
      resolveGerenteServomotoresAssignee,
    } = await import("./mot-servomotores-auto-ingreso");

    const servomotores = await prisma.company.create({ data: { code: "SERVOMOTORES", name: "SM" } });
    const diego = await prisma.user.create({
      data: {
        username: "diego-sm",
        name: "Diego",
        passwordHash: "x",
        role: "GERENTE_OPERATIVO_SERVOMOTORES",
        companyId: servomotores.id,
      },
    });
    const client = await prisma.client.create({
      data: {
        companyId: servomotores.id,
        name: "Cliente",
        active: true,
        isSystem: false,
        requiresInvoice: true,
        rfc: "XAXX010101000",
        cfdiUse: "G03",
        paymentMethod: "PUE",
      },
    });
    const motor = await prisma.equipment.create({
      data: {
        folio: "MOT-AUTO-1",
        kind: "MOT",
        originCompanyId: servomotores.id,
        clientId: client.id,
        model: "M1",
        custody: "PENDIENTE_INGRESO",
        createdByUserId: diego.id,
      },
    });
    const attention = await prisma.attention.create({
      data: {
        equipmentId: motor.id,
        originCompanyId: servomotores.id,
        serviceCompanyId: servomotores.id,
        adminClientId: client.id,
        attentionType: "DIAGNOSTICO",
        priorityName: "Normal",
        priorityPrice: 1000,
        priorityIncrementPct: 0,
        priorityTargetMin: 3,
        priorityTargetMax: 5,
        prioritySlaMaxDays: 7,
        reportedFault: "Falla",
        status: "ABIERTA",
      },
    });

    assert.equal(await resolveGerenteServomotoresAssignee(servomotores.id, diego.id), diego.id);
    const applied = await applyMotServomotoresAutoIngreso({
      equipmentId: motor.id,
      serviceCompanyId: servomotores.id,
      authorUserId: diego.id,
      preferredAssigneeUserId: diego.id,
      attentionId: attention.id,
    });
    assert.equal(applied, true);

    const after = await prisma.equipment.findUnique({ where: { id: motor.id } });
    assert.equal(after?.custody, "EN_RESGUARDO");
    assert.equal(after?.holderCompanyId, servomotores.id);
    const movement = await prisma.custodyMovement.findFirst({ where: { equipmentId: motor.id } });
    assert.equal(movement?.kind, "INGRESO");
    const attentionAfter = await prisma.attention.findUnique({ where: { id: attention.id } });
    assert.notEqual(attentionAfter?.slaStartedAt, null);
    const dxCase = await prisma.technicalCase.findFirst({
      where: { attentionId: attention.id, kind: "DIAGNOSTICO" },
    });
    assert.ok(dxCase);
    assert.equal(dxCase?.assigneeUserId, diego.id);
  });

  it("no aplica en EQUI ni si ya está en resguardo", async () => {
    const { nextCustody } = await import("./custody");
    assert.equal(nextCustody("MOT", "PENDIENTE_INGRESO", "INGRESO"), "EN_RESGUARDO");
  });
});
