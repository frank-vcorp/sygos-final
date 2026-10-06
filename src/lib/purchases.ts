import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { DEFAULT_MONTHLY_PURCHASE, DEFAULT_PURCHASE_LIMIT } from "./roles";
import type { Role } from "./roles";

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

export function withinDirectLimits(amount: number, monthUsed: number, limit: number, budget: number) {
  return amount > 0 && amount <= limit && monthUsed + amount <= budget;
}

export function mexicoMonthRange(date = new Date()) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" })
    .format(date)
    .split("-")
    .map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 6, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 6, 0, 0)),
  };
}

async function monthUsed(userId: string, companyId: string) {
  const { start, end } = mexicoMonthRange();
  const rows = await prisma.purchase.findMany({
    where: { requesterUserId: userId, companyId, kind: "DIRECTA", status: { in: ["PENDIENTE_VALIDAR", "PROCESADA"] }, createdAt: { gte: start, lt: end } },
  });
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

async function limitsOf(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return {
    limit: user?.purchaseLimit ?? DEFAULT_PURCHASE_LIMIT,
    budget: user?.monthlyPurchaseBudget ?? DEFAULT_MONTHLY_PURCHASE,
  };
}

export async function registerDirectPurchase(
  actor: Actor,
  input: { supplierId: string; concept: string; amount: number; destination: string; destinationRef: string | null; quantity: number },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El importe no es válido.");
  const { limit, budget } = await limitsOf(actor.userId);
  const used = await monthUsed(actor.userId, actor.activeCompanyId);
  if (!withinDirectLimits(input.amount, used, limit, budget)) {
    throw new Error(`Supera el límite por compra ($${limit}) o el presupuesto del mes ($${budget}, usado $${used}). Solicita una orden de compra.`);
  }
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId: actor.activeCompanyId, active: true } });
  if (!supplier) throw new Error("Selecciona un proveedor de esta empresa.");
  const folio = await allocateFolio(actor.activeCompanyId, "COM");
  const purchase = await prisma.purchase.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: "DIRECTA",
      status: "PENDIENTE_VALIDAR",
      supplierId: supplier.id,
      concept: input.concept,
      quantity: input.quantity,
      amount: input.amount,
      destination: input.destination,
      destinationRef: input.destinationRef,
      requesterUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: purchase.id,
    action: "ALTA",
    summary: `${folio} consumió presupuesto de compra directa. Falta que Coordinación la valide.`,
    authorUserId: actor.userId,
  });
  return purchase;
}

export async function registerOrder(
  actor: Actor,
  input: { supplierId: string | null; concept: string; amount: number; destination: string; destinationRef: string | null; quantity: number },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El importe no es válido.");
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId: actor.activeCompanyId, active: true } });
    if (!supplier) throw new Error("Ese proveedor no es de esta empresa.");
  }
  const authorized = actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  const folio = await allocateFolio(actor.activeCompanyId, "OC");
  const purchase = await prisma.purchase.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: "OC",
      status: authorized ? "AUTORIZADA" : "PENDIENTE_AUTORIZACION",
      supplierId: input.supplierId,
      concept: input.concept,
      quantity: input.quantity,
      amount: input.amount,
      authorizedAmount: authorized ? input.amount : null,
      destination: input.destination,
      destinationRef: input.destinationRef,
      requesterUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: purchase.id,
    action: "ALTA",
    summary: authorized ? `${folio} quedó autorizada al crearla el CEO.` : `${folio} quedó pendiente de autorización del CEO.`,
    authorUserId: actor.userId,
  });
  return purchase;
}

export async function decideOrder(actor: Actor, purchaseId: string, version: number, authorized: boolean) {
  if (actor.role !== "CEO" && actor.role !== "ADMINISTRADOR") throw new Error("Solo el CEO autoriza una orden de compra.");
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId, kind: "OC", status: "PENDIENTE_AUTORIZACION" } });
  if (!row) throw new Error("Esa orden no está pendiente de autorización.");
  const updated = await prisma.purchase.updateMany({
    where: { id: row.id, version },
    data: authorized
      ? { status: "AUTORIZADA", authorizedAmount: row.amount, version: { increment: 1 } }
      : { status: "RECHAZADA", version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "AUTORIZACION",
    summary: authorized ? `${row.folio} autorizada. No genera deuda ni salida de dinero.` : `${row.folio} rechazada.`,
    authorUserId: actor.userId,
  });
}

export async function editDirectPurchase(actor: Actor, purchaseId: string, version: number, amount: number) {
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId, kind: "DIRECTA", status: "PENDIENTE_VALIDAR" } });
  if (!row) throw new Error("Esa compra directa ya no se puede cuadrar.");
  const { limit, budget } = await limitsOf(row.requesterUserId);
  const used = await monthUsed(row.requesterUserId, row.companyId);
  const others = used - row.amount;
  const fits = withinDirectLimits(amount, others, limit, budget);
  const nextFolio = fits ? row.folio : await allocateFolio(row.companyId, "OC");
  const updated = await prisma.purchase.updateMany({
    where: { id: row.id, version },
    data: fits
      ? { amount, version: { increment: 1 } }
      : { kind: "OC", status: "PENDIENTE_AUTORIZACION", amount, folio: nextFolio, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "CUADRE",
    summary: fits ? `${row.folio} se cuadró a $${amount}.` : `${nextFolio} rebasó el límite y pasó a orden de compra.`,
    authorUserId: actor.userId,
  });
}

export async function discardDirectPurchase(actor: Actor, purchaseId: string, version: number) {
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId, kind: "DIRECTA", status: "PENDIENTE_VALIDAR" } });
  if (!row) throw new Error("Esa compra directa ya no se puede eliminar.");
  const updated = await prisma.purchase.updateMany({
    where: { id: row.id, version },
    data: { status: "ELIMINADA", version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "BAJA",
    summary: `${row.folio} se eliminó antes de procesarse. El presupuesto quedó libre.`,
    authorUserId: actor.userId,
  });
}

export async function changeAuthorizedOrder(actor: Actor, purchaseId: string, version: number, input: { supplierId: string | null; concept: string; amount: number }) {
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId, kind: "OC", status: "AUTORIZADA" } });
  if (!row) throw new Error("Solo una orden autorizada y sin procesar admite un cambio material.");
  const material = input.amount !== row.amount || input.concept !== row.concept || input.supplierId !== row.supplierId;
  if (!material) return;
  const updated = await prisma.purchase.updateMany({
    where: { id: row.id, version },
    data: { status: "PENDIENTE_AUTORIZACION", supplierId: input.supplierId, concept: input.concept, amount: input.amount, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "CAMBIO",
    summary: `${row.folio} cambió después de autorizarse. Vuelve con el CEO. La versión previa era $${row.authorizedAmount ?? row.amount}.`,
    authorUserId: actor.userId,
  });
}

export async function cancelOrder(actor: Actor, purchaseId: string, version: number, reason: string) {
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId, kind: "OC", status: { in: ["AUTORIZADA", "PENDIENTE_AUTORIZACION"] } } });
  if (!row) throw new Error("Esa orden ya no se puede cancelar.");
  if (!reason.trim()) throw new Error("La cancelación exige motivo.");
  const updated = await prisma.purchase.updateMany({
    where: { id: row.id, version },
    data: { status: "CANCELADA", cancelReason: reason.trim(), version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "CANCELACION",
    summary: `${row.folio} cancelada: ${reason.trim()}. No generó egreso ni cuenta por pagar.`,
    authorUserId: actor.userId,
  });
}

async function postMovement(companyId: string, accountId: string, direction: "INGRESO" | "EGRESO", amount: number, category: string, originType: string, originId: string, note: string, pendingProof = false) {
  const account = await prisma.financeAccount.findFirst({ where: { id: accountId, companyId, active: true } });
  if (!account) throw new Error("Selecciona una cuenta de esta empresa.");
  if (account.kind === "TARJETA" && direction === "EGRESO") {
    await prisma.financeAccount.update({ where: { id: account.id }, data: { balance: account.balance + amount } });
  } else if (account.kind !== "TARJETA") {
    const delta = direction === "INGRESO" ? amount : -amount;
    if (account.balance + delta < 0 && account.kind === "EFECTIVO") throw new Error("La caja no tiene saldo para ese egreso.");
    await prisma.financeAccount.update({ where: { id: account.id }, data: { balance: account.balance + delta } });
  }
  return prisma.financeMovement.create({
    data: { companyId, accountId, direction, amount, category, originType, originId, note, pendingProof },
  });
}

export async function processPurchase(actor: Actor, purchaseId: string, version: number, settlement: "CONTADO" | "CREDITO", accountId: string | null) {
  const row = await prisma.purchase.findFirst({ where: { id: purchaseId, companyId: actor.activeCompanyId } });
  if (!row || row.movementId || row.payableId) throw new Error("Esa compra ya tiene un movimiento financiero.");
  const ready = (row.kind === "DIRECTA" && row.status === "PENDIENTE_VALIDAR") || (row.kind === "OC" && row.status === "AUTORIZADA");
  if (!ready) throw new Error("Esa compra no está lista para procesarse.");
  if (!row.supplierId) throw new Error("Indica el proveedor antes de procesar.");
  if (settlement === "CONTADO" && !accountId) throw new Error("El contado sale de una cuenta.");
  if (settlement === "CONTADO" && accountId) {
    const movement = await postMovement(row.companyId, accountId, "EGRESO", row.amount, "Compra", "COMPRA", row.id, row.concept);
    const updated = await prisma.purchase.updateMany({
      where: { id: row.id, version },
      data: { status: "PROCESADA", settlement: "CONTADO", accountId, movementId: movement.id, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
  } else {
    const supplier = await prisma.supplier.findUnique({ where: { id: row.supplierId } });
    const due = new Date();
    due.setDate(due.getDate() + (supplier?.creditDays ?? 0));
    const payable = await prisma.payable.create({
      data: {
        companyId: row.companyId,
        supplierId: row.supplierId,
        purchaseId: row.id,
        equipmentId: row.destination === "MOT" ? row.destinationRef : null,
        amount: row.amount,
        balance: row.amount,
        dueAt: due,
        status: "ABIERTA",
      },
    });
    const updated = await prisma.purchase.updateMany({
      where: { id: row.id, version },
      data: { status: "PROCESADA", settlement: "CREDITO", payableId: payable.id, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COMPRA",
    entityId: row.id,
    action: "PROCESO",
    summary: settlement === "CONTADO" ? `${row.folio} procesada con un egreso.` : `${row.folio} procesada con una cuenta por pagar.`,
    authorUserId: actor.userId,
  });
}

export async function payPayable(actor: Actor, payableId: string, accountId: string, amount: number) {
  const payable = await prisma.payable.findFirst({ where: { id: payableId, companyId: actor.activeCompanyId }, include: { supplier: true } });
  if (!payable || payable.balance <= 0) throw new Error("Esa cuenta por pagar no tiene saldo.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > payable.balance) throw new Error("El pago no cubre un abono válido.");
  const movement = await postMovement(payable.companyId, accountId, "EGRESO", amount, "Pago a proveedor", "CXP", payable.id, payable.supplier.name);
  const balance = Math.round((payable.balance - amount) * 100) / 100;
  await prisma.payable.update({
    where: { id: payable.id },
    data: { balance, status: balance <= 0 ? "SALDADA" : "PARCIAL" },
  });
  return movement;
}

export async function openAccount(actor: Actor, name: string, kind: "BANCO" | "EFECTIVO" | "TARJETA", opening: number) {
  const existing = await prisma.financeAccount.findFirst({ where: { companyId: actor.activeCompanyId, name } });
  if (existing) throw new Error("Ya existe una cuenta con ese nombre.");
  return prisma.financeAccount.create({
    data: { companyId: actor.activeCompanyId, name, kind, balance: kind === "TARJETA" ? Math.max(0, opening) : opening },
  });
}

export async function transferAccounts(actor: Actor, fromId: string, toId: string, amount: number) {
  if (fromId === toId) throw new Error("La transferencia es entre dos cuentas de banco.");
  const [from, to] = await Promise.all([
    prisma.financeAccount.findFirst({ where: { id: fromId, companyId: actor.activeCompanyId } }),
    prisma.financeAccount.findFirst({ where: { id: toId, companyId: actor.activeCompanyId } }),
  ]);
  if (!from || !to || from.kind !== "BANCO" || to.kind !== "BANCO") throw new Error("Solo se transfiere de banco a banco de la misma empresa.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe no es válido.");
  await prisma.financeAccount.update({ where: { id: from.id }, data: { balance: from.balance - amount } });
  await prisma.financeAccount.update({ where: { id: to.id }, data: { balance: to.balance + amount } });
  await prisma.financeMovement.create({
    data: { companyId: actor.activeCompanyId, accountId: from.id, direction: "TRANSFERENCIA", amount, category: "Transferencia", note: `Hacia ${to.name}`, originType: "CUENTA", originId: to.id },
  });
}

export async function manualMovement(actor: Actor, accountId: string, direction: "INGRESO" | "EGRESO", amount: number, category: string, note: string, pendingProof: boolean) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe no es válido.");
  return postMovement(actor.activeCompanyId, accountId, direction, amount, category, "MANUAL", accountId, note, pendingProof);
}

export async function recordCompanyCash(companyId: string, direction: "INGRESO" | "EGRESO", amount: number, method: string, note: string, originId: string) {
  const existing = await prisma.financeMovement.findFirst({ where: { companyId, originType: "PAGO", originId } });
  if (existing) return existing;
  const kind = method === "EFECTIVO" ? "EFECTIVO" : "BANCO";
  const account = await prisma.financeAccount.findFirst({ where: { companyId, kind, active: true }, orderBy: { name: "asc" } });
  if (!account) throw new Error("La empresa no tiene cuenta para registrar el movimiento.");
  return postMovement(companyId, account.id, direction, amount, direction === "INGRESO" ? "Cobro" : "Pago", "PAGO", originId, note);
}

export async function payCard(actor: Actor, cardId: string, bankId: string, amount: number) {
  const [card, bank] = await Promise.all([
    prisma.financeAccount.findFirst({ where: { id: cardId, companyId: actor.activeCompanyId, kind: "TARJETA" } }),
    prisma.financeAccount.findFirst({ where: { id: bankId, companyId: actor.activeCompanyId, kind: "BANCO" } }),
  ]);
  if (!card || !bank) throw new Error("El pago de tarjeta sale de un banco de esta empresa.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > card.balance) throw new Error("El abono no cubre la deuda de la tarjeta.");
  await prisma.financeAccount.update({ where: { id: bank.id }, data: { balance: bank.balance - amount } });
  await prisma.financeAccount.update({ where: { id: card.id }, data: { balance: card.balance - amount } });
  return prisma.financeMovement.create({
    data: { companyId: actor.activeCompanyId, accountId: bank.id, direction: "EGRESO", amount, category: "Pago de tarjeta", note: card.name, originType: "TARJETA", originId: card.id },
  });
}

export async function attachProof(actor: Actor, movementId: string, proofNote: string) {
  const row = await prisma.financeMovement.findFirst({ where: { id: movementId, companyId: actor.activeCompanyId, pendingProof: true } });
  if (!row) throw new Error("Ese movimiento no está pendiente de comprobación.");
  await prisma.financeMovement.update({ where: { id: row.id }, data: { pendingProof: false, proofNote } });
}
