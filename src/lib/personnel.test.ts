import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absenceDiscount,
  bracketRate,
  collaboratorDisplayStatus,
  filterCollaborators,
  hireKindLabel,
  laborProfile,
  normalizeActivities,
  normalizeCommissionTiers,
  overtimeAmount,
  overtimeBands,
  parseActivities,
  parseCommissionTiers,
  primaByWeek,
  splitBySalary,
  vacationBalanceForHire,
  vacationDaysForSeniority,
  weekdaysBetween,
} from "./personnel";
import {
  buildCollaboratorWhatsAppUrl,
  credentialsWhatsAppNoticeFromQuery,
  WHATSAPP_UNLINKED_MESSAGE,
  withWhatsAppDeliveryQuery,
  formatCollaboratorCredentialsMessage,
  generateCollaboratorPassword,
  normalizeWhatsAppPhone,
  suggestCollaboratorUsername,
} from "./collaborator-credentials";
import {
  canAdjustPayrollAmounts,
  formatPayrollFolio,
  isoWeekFromDate,
  parsePayrollPeriodInput,
  payrollStatusLabel,
} from "./payroll";

describe("personal y nómina", () => {
  it("fuerza saldo 0 en ingreso nuevo y guarda medios días en migrado", () => {
    assert.equal(hireKindLabel("NUEVO"), "Nuevo");
    assert.equal(hireKindLabel("MIGRADO"), "Migrado");
    assert.equal(vacationBalanceForHire("NUEVO", 12), 0);
    assert.equal(vacationBalanceForHire("MIGRADO", 7.5), 7.5);
    assert.equal(vacationBalanceForHire("MIGRADO", 0), 0);
    assert.throws(() => vacationBalanceForHire("MIGRADO", -1), /mayor o igual a 0/);
    assert.throws(() => vacationBalanceForHire("MIGRADO", 1.25), /medios días/);
  });

  it("cuenta solo lunes a viernes y reparte la prima del 25% por semana", () => {
    const days = weekdaysBetween("2026-10-05", "2026-10-11");
    assert.deepEqual(days, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    const primas = primaByWeek(["2026-10-09", "2026-10-12"], 400, 100);
    assert.equal(primas.length, 2);
    assert.equal(primas[0].days, 1);
    assert.equal(primas[0].stamped, 100);
    assert.equal(primas[0].cash, 25);
    assert.equal(primas[1].weekStart, "2026-10-12");
  });

  it("parte las horas extra en doble hasta 9 y triple después", () => {
    const bands = overtimeBands(8, 3);
    assert.deepEqual(bands, { doubleHours: 1, tripleHours: 2 });
    const amount = overtimeAmount(1, 2, 100);
    assert.equal(amount, 800);
    assert.deepEqual(splitBySalary(800, 400, 100), { stamped: 640, cash: 160 });
  });

  it("descuenta la ausencia con 7/6 y deja al gerente de Servomotores fuera", () => {
    assert.equal(absenceDiscount(1, 600), 700);
    assert.equal(laborProfile("GERENTE_OPERATIVO_SERVOMOTORES").exempt, true);
    assert.equal(laborProfile("AYUDANTE_GENERAL").exempt, false);
    assert.equal(laborProfile("AYUDANTE_GENERAL").overtimeByManager, true);
    assert.equal(vacationDaysForSeniority(1), 12);
    assert.equal(vacationDaysForSeniority(6), 22);
  });

  it("aplica el intervalo de comisión a toda la facturación", () => {
    const brackets = [{ upTo: 100000, rate: 0.02 }, { upTo: null, rate: 0.03 }];
    assert.equal(bracketRate(80000, brackets), 0.02);
    assert.equal(bracketRate(150000, brackets), 0.03);
  });

  it("ordena los escalafones de comisión por facturación de menor a mayor y permite valor 0", () => {
    const tiers = normalizeCommissionTiers([
      { targetAmount: 250000, kind: "PORCENTAJE", value: 3 },
      { targetAmount: 50000, kind: "PORCENTAJE", value: 0 },
      { targetAmount: 100000, kind: "MONTO", value: 2500 },
    ]);
    assert.deepEqual(tiers, [
      { targetAmount: 50000, kind: "PORCENTAJE", value: 0 },
      { targetAmount: 100000, kind: "MONTO", value: 2500 },
      { targetAmount: 250000, kind: "PORCENTAJE", value: 3 },
    ]);
    assert.deepEqual(parseCommissionTiers(JSON.stringify(tiers)), tiers);
    assert.deepEqual(parseCommissionTiers("invalid"), []);
  });

  it("normaliza actividades comerciales únicamente con nombre y número objetivo", () => {
    const activities = normalizeActivities([
      { name: "  Visitas comerciales ", targetCount: 15.8 },
      { name: "", targetCount: 5 },
      { name: "Llamadas de seguimiento", targetCount: 40 },
    ]);
    assert.deepEqual(activities, [
      { name: "Visitas comerciales", targetCount: 15 },
      { name: "Llamadas de seguimiento", targetCount: 40 },
    ]);
    assert.deepEqual(parseActivities(JSON.stringify(activities)), activities);
  });

  it("filtra colaboradores por nombre, estado (Activos, Inactivos, Todos) y puesto", () => {
    const sample = [
      { status: "ACTIVO", jobTitle: "Ventas", user: { name: "Ana López", role: "VENTAS" } },
      { status: "INACTIVO", jobTitle: "Técnico", user: { name: "Carlos Ruiz", role: "TECNICO" } },
      { status: "BAJA", jobTitle: "Ventas", user: { name: "Luis Gómez", role: "VENTAS" } },
    ];
    assert.equal(collaboratorDisplayStatus("ACTIVO"), "ACTIVO");
    assert.equal(collaboratorDisplayStatus("INACTIVO"), "INACTIVO");
    assert.equal(collaboratorDisplayStatus("BAJA"), "INACTIVO");

    assert.equal(filterCollaborators(sample, { estado: "ACTIVOS" }).length, 1);
    assert.equal(filterCollaborators(sample, { estado: "INACTIVOS" }).length, 2);
    assert.equal(filterCollaborators(sample, { estado: "TODOS" }).length, 3);
    assert.equal(filterCollaborators(sample, { estado: "TODOS", puesto: "Ventas" }).length, 2);
    assert.equal(filterCollaborators(sample, { estado: "TODOS", q: "carlos" }).length, 1);
  });

  it("genera sugerencia de usuario, contraseña y enlace de WhatsApp para credenciales", () => {
    assert.equal(suggestCollaboratorUsername("Juan Pérez"), "juan.perez");
    assert.equal(suggestCollaboratorUsername("María Fernanda Gómez Ruiz"), "maria.gomez");
    assert.equal(suggestCollaboratorUsername("Carlos Alberto Díaz"), "carlos.alberto");
    const pass = generateCollaboratorPassword(42);
    assert.equal(pass.length >= 10, true);
    assert.equal(normalizeWhatsAppPhone("55 1234 5678"), "525512345678");
    const msg = formatCollaboratorCredentialsMessage({
      name: "Juan Pérez",
      username: "juan.perez",
      password: pass,
      roleLabel: "Ventas",
      companyName: "SYSTRON",
    });
    assert.equal(msg.includes("juan.perez"), true);
    assert.equal(msg.includes(pass), true);
    const waUrl = buildCollaboratorWhatsAppUrl({
      phone: "55 1234 5678",
      name: "Juan Pérez",
      username: "juan.perez",
      password: pass,
      roleLabel: "Ventas",
      companyName: "SYSTRON",
    });
    assert.equal(waUrl.startsWith("https://wa.me/525512345678?text="), true);
    assert.equal(msg.includes("Usuario:"), true);
    assert.equal(msg.includes("Contraseña:"), true);
    assert.equal(msg.includes("Rol: Ventas"), true);
    assert.equal(msg.includes("Juan Pérez"), true);
    assert.equal(
      withWhatsAppDeliveryQuery("/personal/colaboradores/abc?creado=1", {
        sentViaBaileys: true,
        message: "Enviado por WhatsApp.",
        messageId: "3EB0",
      }),
      "/personal/colaboradores/abc?creado=1&wa=enviado&waId=3EB0",
    );
    assert.equal(
      withWhatsAppDeliveryQuery("/personal/colaboradores/abc", {
        sentViaBaileys: false,
        message: WHATSAPP_UNLINKED_MESSAGE,
      }),
      "/personal/colaboradores/abc?wa=sin-vincular",
    );
    assert.deepEqual(credentialsWhatsAppNoticeFromQuery({ wa: "sin-vincular" }), { kind: "unlinked" });
    assert.deepEqual(credentialsWhatsAppNoticeFromQuery({ wa: "enviado", waId: "3EB0" }), {
      kind: "sent",
      messageId: "3EB0",
    });
  });

  it("genera folio automático de nómina NOM-<EMPRESA>-<AÑO>-S<SEMANA> y parsea semanas ISO", () => {
    assert.equal(formatPayrollFolio("SYSTRON", 2026, 44), "NOM-SYSTRON-2026-S44");
    assert.equal(formatPayrollFolio("SERVOMOTORES", 2026, 44), "NOM-SERVOMOTORES-2026-S44");
    assert.equal(formatPayrollFolio("SYSTRON", 2026, 5), "NOM-SYSTRON-2026-S05");

    const parsedWeek = parsePayrollPeriodInput("2026-W44");
    assert.equal(parsedWeek.year, 2026);
    assert.equal(parsedWeek.weekNumber, 44);
    assert.equal(parsedWeek.periodStart, "2026-10-26");
    assert.equal(parsedWeek.periodEnd, "2026-11-01");

    const fromDate = isoWeekFromDate("2026-10-30");
    assert.equal(fromDate.year, 2026);
    assert.equal(fromDate.weekNumber, 44);
    assert.equal(fromDate.isoWeekString, "2026-W44");

    assert.equal(payrollStatusLabel("EN_PREPARACION"), "En preparación");
    assert.equal(payrollStatusLabel("PENDIENTE_VALIDACION"), "Pendiente de validación");
    assert.equal(payrollStatusLabel("EN_CORRECCION"), "En corrección");
    assert.equal(payrollStatusLabel("CERRADA"), "Cerrada");

    for (const role of ["CEO", "ADMINISTRADOR", "COORDINACION_ADMINISTRACION"] as const) {
      assert.equal(canAdjustPayrollAmounts(role, "EN_PREPARACION"), true, role);
      assert.equal(canAdjustPayrollAmounts(role, "EN_CORRECCION"), true, role);
      assert.equal(canAdjustPayrollAmounts(role, "PRELIMINAR"), true, role);
      assert.equal(canAdjustPayrollAmounts(role, "PENDIENTE_VALIDACION"), false, role);
      assert.equal(canAdjustPayrollAmounts(role, "CERRADA"), false, role);
      assert.equal(canAdjustPayrollAmounts(role, "AUTORIZADA"), false, role);
    }
    assert.equal(canAdjustPayrollAmounts("VENTAS", "EN_PREPARACION"), false);
    assert.equal(canAdjustPayrollAmounts("GERENTE_OPERATIVO_SYSTRON", "EN_CORRECCION"), false);
  });

  it("flujos de base de datos para Personal > Colaboradores (CEO vs Coordinación)", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "sygos-personnel-"));
    const dbUrl = `file:${join(dir, "test.db")}`;
    process.env.DATABASE_URL = dbUrl;
    execFileSync("./node_modules/.bin/prisma", ["db", "push", "--skip-generate"], {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "ignore",
    });

    const { prisma } = await import("./db");
    const {
      createCollaboratorComplete,
      registerCollaborator,
      updatePersonalDataSection,
      updateBankAccountSection,
      updateCollaboratorCredentialsSection,
      updateCommissionSection,
      updateActivitiesSection,
      updateBonusesSection,
      toggleCollaboratorActiveStatus,
      registerAttendanceIncidence,
      decideAttendanceJustification,
      registerManualEntry,
      registerManualExit,
      requestOvertimeByHours,
      reviewOvertime,
      requestCompensation,
      decideCompensation,
      requestLeavePermission,
      decideLeavePermission,
      addLaborDocument,
    } = await import("./personnel");
    const { verifyPassword } = await import("./crypto");
    const {
      addPayrollDocument,
      generateOrOpenWeeklyPayroll,
      getPayrollPendingWarnings,
      returnPayrollToCorrection,
      sendPayrollToValidation,
      updatePayrollLineAppliedAmounts,
      validateAndClosePayroll,
    } = await import("./payroll");

    const company = await prisma.company.create({ data: { code: "SYSTRON", name: "SYSTRON" } });
    const ceoUser = await prisma.user.create({
      data: { username: "ceo_test", name: "CEO Test", passwordHash: "x", role: "CEO" },
    });
    const coordUser = await prisma.user.create({
      data: { username: "coord_test", name: "Coord Test", passwordHash: "x", role: "COORDINACION_ADMINISTRACION" },
    });
    const empUser = await prisma.user.create({
      data: { username: "emp_test", name: "Empleado Original", passwordHash: "x", role: "VENTAS", companyId: company.id },
    });

    const ceoActor = { userId: ceoUser.id, role: "CEO" as const, activeCompanyId: company.id, activeCompanyCode: "SYSTRON" };
    const coordActor = {
      userId: coordUser.id,
      role: "COORDINACION_ADMINISTRACION" as const,
      activeCompanyId: company.id,
      activeCompanyCode: "SYSTRON",
    };

    // Coordinación no puede dar de alta colaborador
    await assert.rejects(
      () =>
        registerCollaborator(coordActor, {
          userId: empUser.id,
          hireKind: "NUEVO",
          hiredAt: "2026-01-15",
          bossUserId: ceoUser.id,
          dailyStamped: 500,
          dailyCash: 0,
          vacationBalance: 12,
          rfc: "XAXX010101000",
          overtimeRate: 100,
        }),
      /CEO/,
    );

    // CEO da de alta colaborador
    const collab = await registerCollaborator(ceoActor, {
      userId: empUser.id,
      hireKind: "MIGRADO",
      hiredAt: "2026-01-15",
      bossUserId: ceoUser.id,
      dailyStamped: 500,
      dailyCash: 0,
      vacationBalance: 12,
      rfc: "XAXX010101000",
      overtimeRate: 100,
      jobTitle: "Ejecutivo Comercial",
    });

    // CEO edita secciones de Datos
    await updatePersonalDataSection(ceoActor, collab.id, 1, {
      name: "Empleado Actualizado",
      birthDate: "1992-05-10",
      phone: "5512345678",
      email: "emp@systron.mx",
      address: "Calle 1",
      emergencyContact: "María 5599999999",
    });
    await updateCommissionSection(ceoActor, collab.id, 2, true, [
      { targetAmount: 200000, kind: "PORCENTAJE", value: 3 },
      { targetAmount: 50000, kind: "PORCENTAJE", value: 0 },
    ]);
    await updateActivitiesSection(ceoActor, collab.id, 3, true, [{ name: "Visitas", targetCount: 20 }]);
    await updateBonusesSection(ceoActor, collab.id, 4, {
      bonusesEnabled: true,
      punctualityBonusEnabled: true,
      punctualityBonus: 1000,
      productivityBonusEnabled: false,
      productivityBonus: 0,
    });

    // Asistencia: salida sin entrada previa rechaza
    await assert.rejects(() => registerManualExit(coordActor, collab.id, "2026-10-20", "18:00"), /entrada previa/);
    await registerManualEntry(coordActor, collab.id, "2026-10-20", "09:00");
    await registerManualExit(coordActor, collab.id, "2026-10-20", "18:00");

    // Falta con justificación Sí -> PENDIENTE_VALIDACION_CEO -> CEO valida
    await registerAttendanceIncidence(coordActor, collab.id, "2026-10-21", "AUSENCIA", "Cita médica", true);
    const attPending = await prisma.attendanceDay.findUniqueOrThrow({
      where: { collaboratorId_workDate: { collaboratorId: collab.id, workDate: "2026-10-21" } },
    });
    assert.equal(attPending.justificationStatus, "PENDIENTE_VALIDACION_CEO");
    assert.equal(attPending.justified, false);
    await decideAttendanceJustification(ceoActor, attPending.id, attPending.version, true);
    const attValidated = await prisma.attendanceDay.findUniqueOrThrow({ where: { id: attPending.id } });
    assert.equal(attValidated.justificationStatus, "JUSTIFICADA");
    assert.equal(attValidated.justified, true);

    // Horas extra con ajuste de horas autorizadas por CEO (conserva horas solicitadas)
    const ot = await requestOvertimeByHours(coordActor, collab.id, "2026-10-22", 4, "Cierre de proyecto");
    await reviewOvertime(ceoActor, ot.id, ot.version, true, 3);
    const otAfter = await prisma.overtimeRequest.findUniqueOrThrow({ where: { id: ot.id } });
    assert.equal(otAfter.hours, 4);
    assert.equal(otAfter.authorizedHours, 3);
    assert.equal(otAfter.status, "AUTORIZADA");

    // Compensación por evento con ajuste de monto autorizado (conserva monto solicitado)
    const comp = await requestCompensation(coordActor, collab.id, "Apoyo traslado foráneo", 1500, "Viaje Querétaro");
    await decideCompensation(ceoActor, comp.id, comp.version, true, 1200);
    const compAfter = await prisma.compensationRequest.findUniqueOrThrow({ where: { id: comp.id } });
    assert.equal(compAfter.requestedAmount, 1500);
    assert.equal(compAfter.authorizedAmount, 1200);
    assert.equal(compAfter.status, "AUTORIZADA");

    // Permiso de falta autorizado -> reconoce automáticamente como justificada en Asistencia
    const perm = await requestLeavePermission(coordActor, collab.id, "2026-10-23", "2026-10-23", "Trámite personal", null);
    await decideLeavePermission(ceoActor, perm.id, perm.version, true);
    const permAtt = await prisma.attendanceDay.findUniqueOrThrow({
      where: { collaboratorId_workDate: { collaboratorId: collab.id, workDate: "2026-10-23" } },
    });
    assert.equal(permAtt.status, "PERMISO");
    assert.equal(permAtt.justified, true);
    assert.equal(permAtt.justificationStatus, "JUSTIFICADA");

    // Documentos: subir documento
    const doc = await addLaborDocument(coordActor, collab.id, "GENERAL", "Contrato firmado", "", null, {
      fileName: "contrato.pdf",
      mimeType: "application/pdf",
      fileDataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
    });
    assert.equal(doc.title, "Contrato firmado");

    // Deshabilitar y habilitar colaborador conservando historial
    const freshCollab = await prisma.collaborator.findUniqueOrThrow({ where: { id: collab.id } });
    await toggleCollaboratorActiveStatus(ceoActor, collab.id, freshCollab.version, false);
    const disabledCollab = await prisma.collaborator.findUniqueOrThrow({ where: { id: collab.id } });
    assert.equal(disabledCollab.status, "INACTIVO");
    await toggleCollaboratorActiveStatus(ceoActor, collab.id, disabledCollab.version, true);
    const reenabledCollab = await prisma.collaborator.findUniqueOrThrow({ where: { id: collab.id } });
    assert.equal(reenabledCollab.status, "ACTIVO");

    // Alta completa integrada (createCollaboratorComplete) con usuario, credenciales, banco, sueldo, RFC/CURP/NSS
    const integratedCollab = await createCollaboratorComplete(ceoActor, {
      name: "Juan Pérez",
      phone: "5511223344",
      birthDate: "1995-03-20",
      email: "juan.perez@systron.mx",
      address: "Av. Reforma 100",
      emergencyContact: "Laura Pérez 5599887766",
      role: "VENTAS",
      username: "juan.perez",
      password: "Sygos-2026!abc",
      jobTitle: "Ejecutivo de Ventas",
      bossUserId: ceoUser.id,
      hiredAt: "2026-10-30",
      workSchedule: "Lunes a viernes 09:00 a 18:00",
      rfc: "PELJ950320AAA",
      curp: "PELJ950320HDFRRL01",
      nss: "12345678901",
      dailyStamped: 400,
      dailyCash: 150,
      bankName: "BBVA",
      bankAccount: "012180001234567890",
      commissionEnabled: true,
      commissionTiers: [{ targetAmount: 100000, kind: "PORCENTAJE", value: 2 }],
      activitiesEnabled: true,
      activities: [{ name: "Visitas", targetCount: 15 }],
      bonusesEnabled: true,
      punctualityBonusEnabled: true,
      punctualityBonus: 1200,
      productivityBonusEnabled: false,
      productivityBonus: 0,
    });
    assert.equal(collab.hireKind, "MIGRADO");
    assert.equal(collab.vacationBalance, 12);
    assert.equal(integratedCollab.hireKind, "NUEVO");
    assert.equal(integratedCollab.vacationBalance, 0);
    assert.equal(integratedCollab.dailyStamped, 400);
    assert.equal(integratedCollab.dailyCash, 150);

    assert.equal(integratedCollab.bankName, "BBVA");
    assert.equal(integratedCollab.bankAccount, "012180001234567890");
    assert.equal(integratedCollab.credentialPasswordPreview, "Sygos-2026!abc");
    const createdUser = await prisma.user.findUniqueOrThrow({ where: { id: integratedCollab.userId } });
    assert.equal(createdUser.username, "juan.perez");
    assert.equal(verifyPassword("Sygos-2026!abc", createdUser.passwordHash), true);

    // Edición de cuenta bancaria y credenciales por CEO
    await updateBankAccountSection(ceoActor, integratedCollab.id, integratedCollab.version, {
      bankName: "Banorte",
      bankAccount: "072180009876543210",
    });
    const afterBank = await prisma.collaborator.findUniqueOrThrow({ where: { id: integratedCollab.id } });
    assert.equal(afterBank.bankName, "Banorte");
    assert.equal(afterBank.bankAccount, "072180009876543210");

    await updateCollaboratorCredentialsSection(ceoActor, integratedCollab.id, afterBank.version, {
      username: "j.perez",
      role: "VENTAS",
      newPassword: "Clave-9988!xyz",
    });
    const afterCredsCollab = await prisma.collaborator.findUniqueOrThrow({ where: { id: integratedCollab.id } });
    const afterCredsUser = await prisma.user.findUniqueOrThrow({ where: { id: integratedCollab.userId } });
    assert.equal(afterCredsUser.username, "j.perez");
    assert.equal(afterCredsCollab.credentialPasswordPreview, "Clave-9988!xyz");
    assert.equal(verifyPassword("Clave-9988!xyz", afterCredsUser.passwordHash), true);

    // Módulo de Nómina: folio automático, no duplicados, advertencias, ajuste calculado vs aplicado y flujo de estados
    await requestOvertimeByHours(coordActor, integratedCollab.id, "2026-10-28", 2, "Soporte urgente");
    const warningsBefore = await getPayrollPendingWarnings(company.id, "2026-10-26", "2026-11-01");
    assert.equal(warningsBefore.some((w) => w.concept === "Horas extra" && w.collaboratorId === integratedCollab.id), true);

    const firstGen = await generateOrOpenWeeklyPayroll(ceoActor, {
      periodInput: "2026-W44",
      paymentDate: "2026-10-30",
    });
    assert.equal(firstGen.existed, false);
    assert.equal(firstGen.period.folio, "NOM-SYSTRON-2026-S44");

    // Prevención de duplicados: segunda llamada devuelve existed = true con el mismo id y folio
    const duplicateGen = await generateOrOpenWeeklyPayroll(coordActor, {
      periodInput: "2026-W44",
      paymentDate: "2026-10-30",
    });
    assert.equal(duplicateGen.existed, true);
    assert.equal(duplicateGen.period.id, firstGen.period.id);

    const periodRow = await prisma.payrollPeriod.findUniqueOrThrow({
      where: { id: firstGen.period.id },
      include: { lines: true },
    });
    // Aun generada por el CEO, inicia en EN_PREPARACION
    assert.equal(periodRow.status, "EN_PREPARACION");
    assert.equal(periodRow.lines.length, 2);

    const juanLine = periodRow.lines.find((l) => l.collaboratorId === integratedCollab.id)!;
    // Semana ISO lunes a domingo: (400 + 150) × 7 días.
    assert.equal(juanLine.calcSueldo, 3850);
    assert.equal(juanLine.sueldo, 3850);
    assert.equal(juanLine.stampedBase, 2800);
    assert.equal(juanLine.cashBase, 1050);
    assert.equal(juanLine.calcBonos, 1200);
    assert.equal(juanLine.bonos, 1200);

    // CEO ajusta en En preparación sin tocar el valor calculado
    await updatePayrollLineAppliedAmounts(ceoActor, periodRow.id, integratedCollab.id, {
      sueldo: 18000,
      horasExtra: 0,
      bonos: 1200,
      comision: 0,
      compensaciones: 0,
      primaVacacional: 0,
      otrosConceptos: 0,
      descuentos: 0,
    });
    const afterCeoPrep = await prisma.payrollLine.findUniqueOrThrow({ where: { id: juanLine.id } });
    assert.equal(afterCeoPrep.calcSueldo, 3850);
    assert.equal(afterCeoPrep.sueldo, 18000);
    assert.equal(afterCeoPrep.calcBonos, 1200);

    await assert.rejects(
      () =>
        updatePayrollLineAppliedAmounts(
          { ...ceoActor, role: "VENTAS", userId: empUser.id },
          periodRow.id,
          integratedCollab.id,
          {
            sueldo: 1,
            horasExtra: 0,
            bonos: 0,
            comision: 0,
            compensaciones: 0,
            primaVacacional: 0,
            otrosConceptos: 0,
            descuentos: 0,
          },
        ),
      /CEO/,
    );

    // Coordinación sigue pudiendo ajustar el valor aplicado
    await updatePayrollLineAppliedAmounts(coordActor, periodRow.id, integratedCollab.id, {
      sueldo: 18500,
      horasExtra: 500,
      bonos: 1500,
      comision: 2000,
      compensaciones: 0,
      primaVacacional: 0,
      otrosConceptos: 300,
      descuentos: 200,
    });
    const juanLineAdjusted = await prisma.payrollLine.findUniqueOrThrow({ where: { id: juanLine.id } });
    assert.equal(juanLineAdjusted.calcBonos, 1200);
    assert.equal(juanLineAdjusted.bonos, 1500);
    assert.equal(juanLineAdjusted.totalPercepciones, 22800);
    assert.equal(juanLineAdjusted.totalPagar, 22600);

    // Flujo de estados: En preparación -> Enviar a validación -> En corrección -> Enviar a validación -> Validar (Cerrada)
    await sendPayrollToValidation(coordActor, periodRow.id, periodRow.version);
    const inValidation = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodRow.id } });
    assert.equal(inValidation.status, "PENDIENTE_VALIDACION");

    await assert.rejects(
      () =>
        updatePayrollLineAppliedAmounts(ceoActor, periodRow.id, integratedCollab.id, {
          sueldo: 1,
          horasExtra: 0,
          bonos: 0,
          comision: 0,
          compensaciones: 0,
          primaVacacional: 0,
          otrosConceptos: 0,
          descuentos: 0,
        }),
      /En preparación o En corrección/,
    );

    // Coordinación no puede validar ni regresar a corrección
    await assert.rejects(() => validateAndClosePayroll(coordActor, periodRow.id, inValidation.version), /CEO/);
    await assert.rejects(() => returnPayrollToCorrection(coordActor, periodRow.id, inValidation.version), /CEO/);

    // CEO regresa a corrección (conserva folio)
    await returnPayrollToCorrection(ceoActor, periodRow.id, inValidation.version);
    const inCorrection = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodRow.id } });
    assert.equal(inCorrection.status, "EN_CORRECCION");
    assert.equal(inCorrection.folio, "NOM-SYSTRON-2026-S44");

    const adminUser = await prisma.user.create({
      data: { username: "admin_nomina", name: "Admin Nómina", passwordHash: "x", role: "ADMINISTRADOR" },
    });
    const adminActor = {
      userId: adminUser.id,
      role: "ADMINISTRADOR" as const,
      activeCompanyId: company.id,
      activeCompanyCode: "SYSTRON",
    };
    await updatePayrollLineAppliedAmounts(adminActor, periodRow.id, integratedCollab.id, {
      sueldo: 19100,
      horasExtra: 500,
      bonos: 1500,
      comision: 2000,
      compensaciones: 0,
      primaVacacional: 0,
      otrosConceptos: 300,
      descuentos: 200,
    });
    await updatePayrollLineAppliedAmounts(ceoActor, periodRow.id, integratedCollab.id, {
      sueldo: 19000,
      horasExtra: 500,
      bonos: 1500,
      comision: 2000,
      compensaciones: 0,
      primaVacacional: 0,
      otrosConceptos: 300,
      descuentos: 200,
    });
    const afterOpenAdjust = await prisma.payrollLine.findUniqueOrThrow({ where: { id: juanLine.id } });
    assert.equal(afterOpenAdjust.calcSueldo, 3850);
    assert.equal(afterOpenAdjust.calcBonos, 1200);
    assert.equal(afterOpenAdjust.sueldo, 19000);
    assert.equal(afterOpenAdjust.bonos, 1500);

    // Se envía nuevamente a validación y el CEO valida/cierra
    await sendPayrollToValidation(coordActor, periodRow.id, inCorrection.version);
    const inValidation2 = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodRow.id } });
    await validateAndClosePayroll(ceoActor, periodRow.id, inValidation2.version);
    const closedPeriod = await prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodRow.id } });
    assert.equal(closedPeriod.status, "CERRADA");

    // Una vez Cerrada, no permite ajustar importes
    await assert.rejects(
      () =>
        updatePayrollLineAppliedAmounts(ceoActor, periodRow.id, integratedCollab.id, {
          sueldo: 20000,
          horasExtra: 0,
          bonos: 0,
          comision: 0,
          compensaciones: 0,
          primaVacacional: 0,
          otrosConceptos: 0,
          descuentos: 0,
        }),
      /En preparación o En corrección/,
    );

    const payrollDoc = await addPayrollDocument(coordActor, periodRow.id, "Comprobante dispersión S44", {
      fileName: "dispersion.pdf",
      mimeType: "application/pdf",
      fileDataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
    });
    assert.equal(payrollDoc.title, "Comprobante dispersión S44");

    const migratedComplete = await createCollaboratorComplete(ceoActor, {
      name: "Ana Migrada",
      phone: "5588776655",
      role: "VENTAS",
      username: "ana.migrada",
      password: "Sygos-2026!mig",
      jobTitle: "Ejecutivo de Ventas",
      bossUserId: ceoUser.id,
      hireKind: "MIGRADO",
      hiredAt: "2019-04-01",
      vacationBalance: 7.5,
      workSchedule: "Lunes a viernes 09:00 a 18:00",
      rfc: "MAGA900401AAA",
      curp: "MAGA900401MDFRRN02",
      nss: "10987654321",
      dailyStamped: 300,
      dailyCash: 100,
      bankName: "Santander",
      bankAccount: "014180001111111111",
    });
    assert.equal(migratedComplete.hireKind, "MIGRADO");
    assert.equal(migratedComplete.vacationBalance, 7.5);
    assert.equal(migratedComplete.hiredAt.toISOString().slice(0, 10), "2019-04-01");
  });
});
