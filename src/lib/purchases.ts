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
    const movementDetails = purchaseMovementDetails(row);
    const movement = await postMovement(row.companyId, accountId, "EGRESO", row.amount, movementDetails.category, "COMPRA", row.id, movementDetails.note);
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
  const purchase = await prisma.purchase.findFirst({ where: { companyId: payable.companyId, payableId: payable.id } });
  const movementDetails = purchase ? purchaseMovementDetails(purchase) : { category: "Pago a proveedor", note: payable.supplier.name };
  const movement = await postMovement(payable.companyId, accountId, "EGRESO", amount, movementDetails.category, "CXP", payable.id, movementDetails.note);
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

export type ExpenseCatalogSelection = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

export function selectExpenseCatalog(category: ExpenseCatalogSelection | null, subcategoryId?: string | null, requireSubcategory = false) {
  if (!category) throw new Error("La categoría de egreso no existe en el catálogo.");
  const subcategory = subcategoryId ? category.subcategories.find((item) => item.id === subcategoryId) : undefined;
  if (subcategoryId && !subcategory) throw new Error("La subcategoría no pertenece a la categoría seleccionada.");
  if (requireSubcategory && category.subcategories.length && !subcategory) throw new Error("Selecciona una subcategoría del catálogo.");
  return {
    expenseCategoryId: category.id,
    expenseCategory: category.name,
    expenseSubcategoryId: subcategory?.id ?? null,
    expenseSubcategory: subcategory?.name ?? null,
  };
}

export function purchaseMovementDetails(purchase: { expenseCategory: string | null; expenseSubcategory: string | null; concept: string }) {
  const category = [purchase.expenseCategory, purchase.expenseSubcategory].filter(Boolean).join(" · ");
  return { category: category || "Compra", note: purchase.concept };
}

export async function manualMovement(
  actor: Actor,
  accountId: string,
  direction: "INGRESO" | "EGRESO",
  amount: number,
  categoryIds: { incomeCategoryId?: string | null; expenseCategoryId?: string | null; expenseSubcategoryId?: string | null },
  note: string,
  pendingProof: boolean,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe no es válido.");
  if (direction === "INGRESO") {
    const category = await prisma.incomeCategory.findFirst({
      where: { id: categoryIds.incomeCategoryId ?? "", companyId: actor.activeCompanyId, active: true },
    });
    if (!category) throw new Error("Selecciona una categoría de ingreso del catálogo.");
    return postMovement(actor.activeCompanyId, accountId, direction, amount, category.name, "MANUAL", accountId, note, pendingProof);
  }
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryIds.expenseCategoryId ?? "", companyId: actor.activeCompanyId, active: true },
    include: { subcategories: { where: { active: true } } },
  });
  const selection = selectExpenseCatalog(category, categoryIds.expenseSubcategoryId);
  const label = [selection.expenseCategory, selection.expenseSubcategory].filter(Boolean).join(" · ");
  return postMovement(actor.activeCompanyId, accountId, direction, amount, label, "MANUAL", accountId, note, pendingProof);
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

export type PurchaseLineInput = {
  partNumber: string;
  description?: string;
  quantity: number;
  sourceType?: string | null;
  sourceId?: string | null;
};

export type PurchaseFinanceInput = {
  supplierId: string;
  expenseCategoryId?: string | null;
  expenseSubcategoryId?: string | null;
  paymentType: string;
  accountId?: string | null;
  purchaseDate: Date;
  amount: number;
  concept: string;
};

export function requirementStatusAfter(action: "ADD_TO_LIST" | "REMOVE_FROM_LIST" | "BUY") {
  return action === "ADD_TO_LIST" ? "EN_LISTA" : action === "REMOVE_FROM_LIST" ? "PENDIENTE" : "ATENDIDO";
}

export function sourceRequirementIsDuplicate(existing: { id: string } | null) {
  return Boolean(existing);
}

export function shoppingListSupplierId(existingSupplierId: string | null, submittedSupplierId?: string | null) {
  return existingSupplierId ?? submittedSupplierId ?? null;
}

export function shoppingListStatusFilter(status?: string) {
  if (status === "CONVERTIDA") return "CONVERTIDA";
  if (status === "TODAS") return undefined;
  return "ABIERTA";
}

export function requirementsNeedExpenseSelection(kinds: string[]) {
  return kinds.some((kind) => kind !== "REFACCION");
}

export function purchaseConceptDefault(kind: "GENERAL" | "REFACCION", concept?: string | null, fallback?: string | null) {
  return concept?.trim() || (kind === "REFACCION" ? "Compra de refacciones y componentes" : fallback?.trim() || "Compra urgente");
}

function accountRequired(paymentType: string) {
  return ["TARJETA", "TRANSFERENCIA"].includes(paymentType);
}

async function validFinanceInput(actor: Actor, input: PurchaseFinanceInput, defaultsToRefacciones = false) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto no es válido.");
  if (!input.purchaseDate || Number.isNaN(input.purchaseDate.valueOf())) throw new Error("Indica una fecha de compra válida.");
  if (!input.paymentType.trim()) throw new Error("Indica la forma de pago.");
  if (accountRequired(input.paymentType) && !input.accountId) throw new Error("Selecciona el banco o cuenta para esta forma de pago.");
  const supplier = await supplierForPurchase(actor, input.supplierId);
  const category = await prisma.expenseCategory.findFirst({
    where: defaultsToRefacciones && !input.expenseCategoryId
      ? { companyId: actor.activeCompanyId, active: true, name: "Producción y operación" }
      : { id: input.expenseCategoryId ?? "", companyId: actor.activeCompanyId, active: true },
    include: { subcategories: { where: { active: true } } },
  });
  const refaccionesSubcategoryId = defaultsToRefacciones && !input.expenseSubcategoryId
    ? category?.subcategories.find((subcategory) => subcategory.name === "Refacciones y componentes")?.id
    : input.expenseSubcategoryId;
  const selection = selectExpenseCatalog(category, refaccionesSubcategoryId, defaultsToRefacciones || Boolean(category?.subcategories.length));
  return { supplier, ...selection };
}

export async function createRequirement(
  actor: Actor,
  input: { partNumber: string; description?: string; quantity: number; kind?: "REFACCION" | "GENERAL"; sourceType?: string | null; sourceId?: string | null },
) {
  if (actor.role === "TECNICO") throw new Error("Los Técnicos solicitan refacciones desde OS o DX.");
  if (!input.partNumber.trim()) throw new Error("Indica el número de parte.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La cantidad debe ser mayor a cero.");
  if (input.sourceType && input.sourceId) {
    const existing = await prisma.requirement.findFirst({ where: { companyId: actor.activeCompanyId, sourceType: input.sourceType, sourceId: input.sourceId } });
    if (existing) return existing;
  }
  return prisma.requirement.create({
    data: {
      companyId: actor.activeCompanyId,
      partNumber: input.partNumber.trim(),
      description: input.description?.trim() ?? "",
      quantity: input.quantity,
      kind: input.kind ?? (input.sourceType ? "REFACCION" : "GENERAL"),
      requesterUserId: actor.userId,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
    },
  });
}

export async function editRequirement(
  actor: Actor,
  requirementId: string,
  input: { partNumber: string; description?: string; quantity: number },
) {
  const row = await prisma.requirement.findFirst({ where: { id: requirementId, companyId: actor.activeCompanyId, status: "PENDIENTE" } });
  if (!row) throw new Error("El requerimiento ya no está pendiente.");
  if (actor.role === "TECNICO" || (row.requesterUserId !== actor.userId && !["GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "CEO", "ADMINISTRADOR", "COORDINACION_ADMINISTRACION"].includes(actor.role))) {
    throw new Error("No tienes permiso para editar este requerimiento.");
  }
  if (!input.partNumber.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La partida no es válida.");
  return prisma.requirement.update({
    where: { id: row.id },
    data: { partNumber: input.partNumber.trim(), description: input.description?.trim() ?? "", quantity: input.quantity },
  });
}

export async function setRequirementStatus(actor: Actor, requirementId: string, status: "ATENDIDO" | "CANCELADO") {
  if (!["GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES", "CEO", "ADMINISTRADOR", "COORDINACION_ADMINISTRACION"].includes(actor.role)) {
    throw new Error("Solo el gerente puede cambiar el estado del requerimiento.");
  }
  const updated = await prisma.requirement.updateMany({
    where: { id: requirementId, companyId: actor.activeCompanyId, status: "PENDIENTE" },
    data: { status },
  });
  if (!updated.count) throw new Error("El requerimiento ya no está pendiente.");
}

export async function purchaseRequirement(actor: Actor, requirementId: string, input: PurchaseFinanceInput) {
  const requirement = await prisma.requirement.findFirst({
    where: { id: requirementId, companyId: actor.activeCompanyId, status: "PENDIENTE" },
  });
  if (!requirement) throw new Error("El requerimiento ya no está pendiente.");
  const finance = await validFinanceInput(actor, input, requirement.kind === "REFACCION");
  const folio = await allocateFolio(actor.activeCompanyId, "COM");
  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        folio,
        companyId: actor.activeCompanyId,
        kind: "COMPRA",
        status: "PENDIENTE_VALIDAR",
        supplierId: finance.supplier.id,
        currency: finance.supplier.currency,
        expenseCategory: finance.expenseCategory,
        expenseSubcategory: finance.expenseSubcategory,
        expenseCategoryId: finance.expenseCategoryId,
        expenseSubcategoryId: finance.expenseSubcategoryId,
        paymentType: input.paymentType.trim(),
        accountId: input.accountId ?? null,
        purchaseDate: input.purchaseDate,
        concept: input.concept.trim() || (requirement.kind === "REFACCION" ? "Compra de refacciones y componentes" : requirement.description || requirement.partNumber),
        quantity: requirement.quantity,
        amount: input.amount,
        destination: "REQUERIMIENTO",
        destinationRef: requirement.id,
        requesterUserId: actor.userId,
        lines: requirement.kind === "REFACCION" ? { create: [{
          requirementId: requirement.id,
          partNumber: requirement.partNumber,
          description: requirement.description,
          quantity: requirement.quantity,
          sourceType: requirement.sourceType,
          sourceId: requirement.sourceId,
        }] } : undefined,
      },
    });
    const updated = await tx.requirement.updateMany({
      where: { id: requirement.id, status: "PENDIENTE" },
      data: { status: requirementStatusAfter("BUY"), purchaseId: created.id },
    });
    if (!updated.count) throw new ConcurrencyError();
    return created;
  });
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COMPRA", entityId: purchase.id, action: "ALTA", summary: `${folio} creada desde requerimiento.`, authorUserId: actor.userId });
  return purchase;
}

export async function addRequirementToShoppingList(
  actor: Actor,
  requirementId: string,
  input: { shoppingListId?: string | null; supplierId?: string | null; partNumber: string; description?: string; quantity: number },
) {
  if (!input.partNumber.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La partida no es válida.");
  const requirement = await prisma.requirement.findFirst({ where: { id: requirementId, companyId: actor.activeCompanyId, status: "PENDIENTE" } });
  if (!requirement) throw new Error("El requerimiento ya no está pendiente.");
  let list = input.shoppingListId
    ? await prisma.shoppingList.findFirst({ where: { id: input.shoppingListId, companyId: actor.activeCompanyId, status: "ABIERTA" } })
    : null;
  if (input.shoppingListId && !list) throw new Error("La lista de compras ya no está abierta.");
  const supplierId = shoppingListSupplierId(list?.supplierId ?? null, input.supplierId);
  if (supplierId) await supplierForPurchase(actor, supplierId);
  if (!list) {
    const folio = await allocateFolio(actor.activeCompanyId, "LC");
    list = await prisma.shoppingList.create({
      data: { folio, companyId: actor.activeCompanyId, status: "ABIERTA", supplierId, createdByUserId: actor.userId },
    });
  } else if (!list.supplierId && supplierId) {
    list = await prisma.shoppingList.update({ where: { id: list.id }, data: { supplierId } });
  }
  await prisma.$transaction(async (tx) => {
    const moved = await tx.requirement.updateMany({
      where: { id: requirement.id, status: "PENDIENTE", shoppingListId: null },
      data: { status: requirementStatusAfter("ADD_TO_LIST"), shoppingListId: list!.id },
    });
    if (!moved.count) throw new ConcurrencyError();
    await tx.shoppingListLine.create({
      data: { shoppingListId: list!.id, requirementId: requirement.id, partNumber: input.partNumber.trim(), description: input.description?.trim() ?? "", quantity: input.quantity, sourceType: requirement.sourceType, sourceId: requirement.sourceId },
    });
  });
  return list;
}

export async function updateShoppingListLine(actor: Actor, lineId: string, input: { partNumber: string; description?: string; quantity: number }) {
  if (!input.partNumber.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La partida no es válida.");
  const line = await prisma.shoppingListLine.findFirst({ where: { id: lineId, shoppingList: { companyId: actor.activeCompanyId, status: "ABIERTA" } } });
  if (!line) throw new Error("La partida ya no está disponible para edición.");
  return prisma.shoppingListLine.update({ where: { id: line.id }, data: { partNumber: input.partNumber.trim(), description: input.description?.trim() ?? "", quantity: input.quantity } });
}

export async function removeShoppingListLine(actor: Actor, lineId: string) {
  const line = await prisma.shoppingListLine.findFirst({ where: { id: lineId, shoppingList: { companyId: actor.activeCompanyId, status: "ABIERTA" } } });
  if (!line) throw new Error("La partida ya no está disponible.");
  await prisma.$transaction([
    prisma.shoppingListLine.delete({ where: { id: line.id } }),
    prisma.requirement.update({ where: { id: line.requirementId }, data: { status: requirementStatusAfter("REMOVE_FROM_LIST"), shoppingListId: null } }),
  ]);
}

export async function setShoppingListSupplier(actor: Actor, listId: string, supplierId: string | null) {
  const list = await prisma.shoppingList.findFirst({ where: { id: listId, companyId: actor.activeCompanyId, status: "ABIERTA" } });
  if (!list) throw new Error("La lista ya no está abierta.");
  if (supplierId) await supplierForPurchase(actor, supplierId);
  return prisma.shoppingList.update({ where: { id: list.id }, data: { supplierId } });
}

export async function convertShoppingListToPurchase(actor: Actor, listId: string, input: PurchaseFinanceInput) {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, companyId: actor.activeCompanyId, status: "ABIERTA" },
    include: { lines: { include: { requirement: { select: { kind: true, description: true, partNumber: true } } } } },
  });
  if (!list || !list.lines.length) throw new Error("La lista debe tener al menos una partida antes de convertirla.");
  const onlyRefacciones = !requirementsNeedExpenseSelection(list.lines.map((line) => line.requirement.kind));
  const finance = await validFinanceInput(
    actor,
    { ...input, supplierId: input.supplierId || list.supplierId || "" },
    onlyRefacciones,
  );
  const generalLine = list.lines.find((line) => line.requirement.kind !== "REFACCION");
  const concept = purchaseConceptDefault(
    onlyRefacciones ? "REFACCION" : "GENERAL",
    input.concept,
    generalLine?.requirement.description || generalLine?.description || generalLine?.partNumber || "Compra de lista",
  );
  const folio = await allocateFolio(actor.activeCompanyId, "COM");
  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        folio, companyId: actor.activeCompanyId, kind: "COMPRA", status: "PENDIENTE_VALIDAR",
        shoppingListId: list.id, supplierId: finance.supplier.id, currency: finance.supplier.currency,
        expenseCategory: finance.expenseCategory, expenseSubcategory: finance.expenseSubcategory,
        expenseCategoryId: finance.expenseCategoryId, expenseSubcategoryId: finance.expenseSubcategoryId,
        paymentType: input.paymentType.trim(), accountId: input.accountId ?? null, purchaseDate: input.purchaseDate,
        concept, quantity: list.lines.length,
        amount: input.amount, destination: "LISTA_COMPRAS", destinationRef: list.id, requesterUserId: actor.userId,
        lines: { create: list.lines.map((line) => ({ requirementId: line.requirementId, shoppingListLineId: line.id, partNumber: line.partNumber, description: line.description, quantity: line.quantity, sourceType: line.sourceType, sourceId: line.sourceId })) },
      },
    });
    await tx.requirement.updateMany({ where: { shoppingListId: list.id, status: "EN_LISTA" }, data: { status: requirementStatusAfter("BUY"), purchaseId: created.id } });
    await tx.shoppingList.update({ where: { id: list.id }, data: { status: "CONVERTIDA", supplierId: finance.supplier.id } });
    return created;
  });
  await recordHistory({ companyId: actor.activeCompanyId, entityType: "COMPRA", entityId: purchase.id, action: "ALTA", summary: `${folio} creada desde ${list.folio}.`, authorUserId: actor.userId });
  return purchase;
}

function normalizedLines(lines: PurchaseLineInput[]) {
  if (!lines.length) throw new Error("Agrega al menos una partida.");
  return lines.map((line) => {
    if (!line.partNumber.trim() || !Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("Todas las partidas deben tener número y cantidad.");
    return { ...line, partNumber: line.partNumber.trim(), description: line.description?.trim() ?? "" };
  });
}

async function supplierForPurchase(actor: Actor, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId: actor.activeCompanyId, active: true } });
  if (!supplier) throw new Error("Selecciona un proveedor activo de esta empresa.");
  return supplier;
}

export async function createPhaseOnePurchase(
  actor: Actor,
  input: {
    supplierId: string;
    expenseCategoryId?: string | null;
    expenseSubcategoryId?: string | null;
    paymentType: string;
    accountId?: string | null;
    purchaseDate?: Date | null;
    amount: number;
    lines: PurchaseLineInput[];
    order?: boolean;
    concept?: string;
    purchaseKind?: "GENERAL" | "REFACCION";
  },
) {
  const lines = input.lines.length ? normalizedLines(input.lines) : [];
  if (!lines.length && !input.concept?.trim() && input.purchaseKind !== "REFACCION") throw new Error("Indica una descripción general o una partida.");
  const refacciones = input.purchaseKind === "REFACCION";
  const concept = purchaseConceptDefault(refacciones ? "REFACCION" : "GENERAL", input.concept, lines[0]?.description || lines[0]?.partNumber);
  const finance = await validFinanceInput(actor, {
    supplierId: input.supplierId,
    expenseCategoryId: input.expenseCategoryId,
    expenseSubcategoryId: input.expenseSubcategoryId,
    paymentType: input.paymentType,
    accountId: input.accountId,
    purchaseDate: input.purchaseDate ?? new Date(),
    amount: input.amount,
    concept,
  }, refacciones);
  const folio = await allocateFolio(actor.activeCompanyId, input.order ? "OC" : "COM");
  return prisma.purchase.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: input.order ? "OC" : "COMPRA",
      status: input.order ? "PENDIENTE_AUTORIZACION" : "PENDIENTE_VALIDAR",
      supplierId: finance.supplier.id,
      currency: finance.supplier.currency,
      expenseCategory: finance.expenseCategory,
      expenseSubcategory: finance.expenseSubcategory,
      expenseCategoryId: finance.expenseCategoryId,
      expenseSubcategoryId: finance.expenseSubcategoryId,
      paymentType: input.paymentType.trim(),
      accountId: input.accountId ?? null,
      purchaseDate: input.purchaseDate ?? null,
      concept,
      quantity: lines[0]?.quantity ?? 1,
      amount: input.amount,
      destination: "INVENTARIO",
      requesterUserId: actor.userId,
      lines: lines.length ? { create: lines } : undefined,
    },
    include: { lines: true, supplier: true },
  });
}

export async function attachProof(actor: Actor, movementId: string, proofNote: string) {
  const row = await prisma.financeMovement.findFirst({ where: { id: movementId, companyId: actor.activeCompanyId, pendingProof: true } });
  if (!row) throw new Error("Ese movimiento no está pendiente de comprobación.");
  await prisma.financeMovement.update({ where: { id: row.id }, data: { pendingProof: false, proofNote } });
}
