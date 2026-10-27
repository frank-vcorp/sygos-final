"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { supplierIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { moneyFromForm } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import { addRequirementToShoppingList, cancelOrder, changeAuthorizedOrder, convertShoppingListToPurchase, createPhaseOnePurchase, createRequirement, createShoppingList, decideOrder, discardDirectPurchase, editDirectPurchase, editRequirement, processPurchase, purchaseRequirement, registerDirectPurchase, registerOrder, removeShoppingListLine, requirementPartNumberRequired, setRequirementStatus, setShoppingListSupplier, updateShoppingListLine } from "@/lib/purchases";
import { requireCompany } from "@/lib/session";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
  return session;
}

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function directPurchaseAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const supplierId = await supplierIdFromForm(session, formData, { required: true });
    if (!supplierId) throw new Error("Elige un proveedor.");
    const purchase = await registerDirectPurchase(session, {
      supplierId,
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: moneyFromForm(formData.get("amount")),
      destination: requiredText(formData.get("destination"), "Destino"),
      destinationRef: optionalText(formData.get("destinationRef")),
      quantity: Number(formData.get("quantity") || 1),
    });
    await setFlash({ tone: "ok", message: `${purchase.folio} registrada dentro del presupuesto.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/compras/nueva");
  }
}

export async function orderAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const purchase = await registerOrder(session, {
      supplierId: await supplierIdFromForm(session, formData),
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: moneyFromForm(formData.get("amount")),
      destination: requiredText(formData.get("destination"), "Destino"),
      destinationRef: optionalText(formData.get("destinationRef")),
      quantity: Number(formData.get("quantity") || 1),
    });
    await setFlash({ tone: "ok", message: `${purchase.folio} registrada.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/compras/oc");
  }
}

export async function decideOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("purchase.authorize");
    await decideOrder(session, id, parseVersion(formData.get("version")), formData.get("decision") === "si");
    await setFlash({ tone: "ok", message: "Decisión registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function editDirectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await editDirectPurchase(session, id, parseVersion(formData.get("version")), moneyFromForm(formData.get("amount")));
    await setFlash({ tone: "ok", message: "Compra cuadrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function discardDirectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await discardDirectPurchase(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Compra eliminada. El presupuesto quedó libre." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/compras");
}

export async function changeOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await changeAuthorizedOrder(session, id, parseVersion(formData.get("version")), {
      supplierId: await supplierIdFromForm(session, formData),
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: moneyFromForm(formData.get("amount")),
    });
    await setFlash({ tone: "ok", message: "El cambio volvió a autorización del CEO." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function cancelOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    if (session.role !== "CEO" && session.role !== "ADMINISTRADOR" && session.role !== "COORDINACION_ADMINISTRACION") {
      throw new Error("CEO o Coordinación cancelan la orden.");
    }
    await cancelOrder(session, id, parseVersion(formData.get("version")), requiredText(formData.get("reason"), "Motivo"));
    await setFlash({ tone: "ok", message: "Orden cancelada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function processPurchaseAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    const settlement = formData.get("settlement") === "CREDITO" ? "CREDITO" : "CONTADO";
    await processPurchase(session, id, parseVersion(formData.get("version")), settlement, optionalText(formData.get("accountId")));
    await setFlash({ tone: "ok", message: settlement === "CREDITO" ? "Quedó una cuenta por pagar." : "Quedó un egreso." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export type CreateRequirementState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function createRequirementAction(
  _previousState: CreateRequirementState,
  formData: FormData,
): Promise<CreateRequirementState> {
  "use server";
  try {
    const session = await requireCompany();
    if (!can(session.role, "purchase.requirement.create", session.activeCompanyCode)) throw new Error("Los Técnicos deben solicitar refacciones desde OS o DX.");
    const kind = formData.get("kind") === "REFACCION" ? "REFACCION" : "GENERAL";
    const requirement = await createRequirement(session, {
      partNumber: requirementPartNumberRequired(kind)
        ? requiredText(formData.get("partNumber"), "Número de parte")
        : optionalText(formData.get("partNumber")) ?? "",
      description: optionalText(formData.get("description")) ?? "",
      quantity: Number(formData.get("quantity")),
      kind,
    });
    const shoppingListId = optionalText(formData.get("shoppingListId"));
    if (shoppingListId) {
      if (!can(session.role, "purchase.operate", session.activeCompanyCode)) {
        throw new Error("No puedes agregar partidas a una lista de compras.");
      }
      await addRequirementToShoppingList(session, requirement.id, {
        shoppingListId,
        partNumber: requirement.partNumber,
        description: requirement.description,
        quantity: requirement.quantity,
      });
      await setFlash({ tone: "ok", message: "Requerimiento agregado a la lista." });
      revalidatePath(`/compras/listas/${shoppingListId}`);
    } else {
      await setFlash({ tone: "ok", message: "Requerimiento creado." });
    }
    revalidatePath("/compras/requerimientos");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

export async function importTechnicalRequirementAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const sourceType = requiredText(formData.get("sourceType"), "Origen");
    const sourceId = requiredText(formData.get("sourceId"), "Solicitud");
    if (sourceType === "OS") {
      const source = await prisma.partRequest.findFirst({ where: { id: sourceId, companyId: session.activeCompanyId, status: "SOLICITADA" } });
      if (!source) throw new Error("La solicitud de OS ya no está pendiente.");
      await createRequirement(session, { partNumber: source.partNumber, description: source.description, quantity: source.qtyRequested, sourceType, sourceId });
    } else if (sourceType === "DX") {
      const source = await prisma.partPresolicitud.findFirst({ where: { id: sourceId, companyId: session.activeCompanyId, status: "ACTIVA" } });
      if (!source) throw new Error("La solicitud de DX ya no está activa.");
      await createRequirement(session, { partNumber: source.partNumber, description: source.description, quantity: source.qtyRequested, sourceType, sourceId });
    } else throw new Error("Origen de solicitud no válido.");
    await setFlash({ tone: "ok", message: "Solicitud técnica incorporada a Requerimientos." });
  } catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect("/compras/requerimientos");
}

export async function updateRequirementAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const session = await guard("purchase.operate");
    await editRequirement(session, id, {
      partNumber: requiredText(formData.get("partNumber"), "Número de parte"),
      description: optionalText(formData.get("description")) ?? "",
      quantity: Number(formData.get("quantity")),
    });
    await setFlash({ tone: "ok", message: "Requerimiento actualizado." });
  } catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect("/compras/requerimientos");
}

export async function requirementStatusAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const session = await guard("purchase.operate");
    await setRequirementStatus(session, id, formData.get("status") === "CANCELADO" ? "CANCELADO" : "ATENDIDO");
    await setFlash({ tone: "ok", message: "Estado actualizado." });
  } catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect("/compras/requerimientos");
}

export async function phaseOnePurchaseAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const purchaseKind = formData.get("purchaseKind") === "REFACCION" ? "REFACCION" : "GENERAL";
    const linePart = optionalText(formData.get("partNumber"));
    const lines: { partNumber: string; description: string; quantity: number }[] = linePart
      ? [{ partNumber: linePart, description: optionalText(formData.get("description")) ?? "", quantity: Number(formData.get("quantity")) }]
      : JSON.parse(String(formData.get("lines") || "[]"));
    const purchase = await createPhaseOnePurchase(session, {
      supplierId: requiredText(formData.get("supplierId"), "Proveedor"),
      expenseCategoryId: optionalText(formData.get("expenseCategoryId")),
      expenseSubcategoryId: optionalText(formData.get("expenseSubcategoryId")),
      paymentType: requiredText(formData.get("paymentType"), "Tipo de pago"),
      accountId: optionalText(formData.get("accountId")),
      purchaseDate: new Date(requiredText(formData.get("purchaseDate"), "Fecha de compra")),
      amount: moneyFromForm(formData.get("amount")),
      lines,
      order: formData.get("order") === "si",
      concept: optionalText(formData.get("concept")) ?? undefined,
      purchaseKind,
    });
    await setFlash({ tone: "ok", message: `${purchase.folio} creada.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect(formData.get("order") === "si" ? "/compras/oc" : "/compras?registrar=1");
  }
}

function purchaseFinanceFromForm(formData: FormData) {
  return {
    supplierId: optionalText(formData.get("supplierId")) ?? "",
    expenseCategoryId: optionalText(formData.get("expenseCategoryId")),
    expenseSubcategoryId: optionalText(formData.get("expenseSubcategoryId")),
    paymentType: requiredText(formData.get("paymentType"), "Forma de pago"),
    accountId: optionalText(formData.get("accountId")),
    purchaseDate: new Date(requiredText(formData.get("purchaseDate"), "Fecha de compra")),
    amount: moneyFromForm(formData.get("amount")),
    concept: optionalText(formData.get("concept")) ?? "",
  };
}

function purchaseRequirementFinanceFromForm(formData: FormData) {
  return {
    supplierId: optionalText(formData.get("supplierId")) ?? "",
    expenseCategoryId: optionalText(formData.get("expenseCategoryId")),
    expenseSubcategoryId: optionalText(formData.get("expenseSubcategoryId")),
    paymentType: requiredText(formData.get("paymentType"), "Forma de pago"),
    accountId: optionalText(formData.get("accountId")),
    purchaseDate: new Date(),
    amount: moneyFromForm(formData.get("amount")),
    concept: optionalText(formData.get("concept")) ?? "",
  };
}

function convertShoppingListFinanceFromForm(formData: FormData) {
  return purchaseRequirementFinanceFromForm(formData);
}

export type RequirementOverlayState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function purchaseRequirementAction(formData: FormData) {
  const requirementId = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const purchase = await purchaseRequirement(await guard("purchase.operate"), requirementId, purchaseRequirementFinanceFromForm(formData));
    await setFlash({ tone: "ok", message: `${purchase.folio} creada desde el requerimiento.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect(`/compras/requerimientos/${requirementId}/comprar`);
  }
}

export async function purchaseRequirementOverlayAction(
  _previousState: RequirementOverlayState,
  formData: FormData,
): Promise<RequirementOverlayState> {
  "use server";
  const requirementId = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const purchase = await purchaseRequirement(await guard("purchase.operate"), requirementId, purchaseRequirementFinanceFromForm(formData));
    await setFlash({ tone: "ok", message: `${purchase.folio} creada desde el requerimiento.` });
    revalidatePath("/compras/requerimientos");
    return { status: "success", message: `${purchase.folio} registrada.` };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

export async function addToShoppingListAction(formData: FormData) {
  const requirementId = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const list = await addRequirementToShoppingList(await guard("purchase.operate"), requirementId, {
      shoppingListId: optionalText(formData.get("shoppingListId")),
      supplierId: optionalText(formData.get("supplierId")),
      partNumber: partNumberFromRequirementForm(formData),
      description: optionalText(formData.get("description")) ?? "",
      quantity: Number(formData.get("quantity")),
    });
    await setFlash({ tone: "ok", message: `${requirementId} se agregó a ${list.folio}.` });
    redirect(`/compras/listas/${list.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect(`/compras/requerimientos/${requirementId}/agregar-a-lista`);
  }
}

export async function addToShoppingListOverlayAction(
  _previousState: RequirementOverlayState,
  formData: FormData,
): Promise<RequirementOverlayState> {
  "use server";
  const requirementId = requiredText(formData.get("requirementId"), "Requerimiento");
  try {
    const list = await addRequirementToShoppingList(await guard("purchase.operate"), requirementId, {
      shoppingListId: optionalText(formData.get("shoppingListId")),
      supplierId: optionalText(formData.get("supplierId")),
      partNumber: partNumberFromRequirementForm(formData),
      description: optionalText(formData.get("description")) ?? "",
      quantity: Number(formData.get("quantity")),
    });
    await setFlash({ tone: "ok", message: `Agregado a ${list.folio}.` });
    revalidatePath("/compras/requerimientos");
    return { status: "success", message: `Agregado a ${list.folio}.` };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

function partNumberFromRequirementForm(formData: FormData) {
  const kind = formData.get("requirementKind") === "REFACCION" ? "REFACCION" : "GENERAL";
  return requirementPartNumberRequired(kind)
    ? requiredText(formData.get("partNumber"), "Número de parte")
    : optionalText(formData.get("partNumber")) ?? "";
}

export async function updateShoppingListLineSilentAction(input: {
  listId: string;
  lineId: string;
  partNumber: string;
  description: string;
  quantity: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await updateShoppingListLine(await guard("purchase.operate"), input.lineId, {
      partNumber: input.partNumber,
      description: input.description,
      quantity: input.quantity,
    });
    revalidatePath(`/compras/listas/${input.listId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: bubble(error) };
  }
}

export async function setShoppingListSupplierSilentAction(
  listId: string,
  supplierId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await setShoppingListSupplier(await guard("purchase.operate"), listId, supplierId);
    revalidatePath(`/compras/listas/${listId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: bubble(error) };
  }
}

export async function updateShoppingListLineAction(formData: FormData) {
  const listId = requiredText(formData.get("listId"), "Lista");
  try {
    await updateShoppingListLine(await guard("purchase.operate"), requiredText(formData.get("lineId"), "Partida"), {
      partNumber: requiredText(formData.get("partNumber"), "Número de parte"),
      description: optionalText(formData.get("description")) ?? "",
      quantity: Number(formData.get("quantity")),
    });
    await setFlash({ tone: "ok", message: "Partida actualizada." });
  } catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect(`/compras/listas/${listId}`);
}

export async function removeShoppingListLineAction(formData: FormData) {
  const listId = requiredText(formData.get("listId"), "Lista");
  try { await removeShoppingListLine(await guard("purchase.operate"), requiredText(formData.get("lineId"), "Partida")); await setFlash({ tone: "ok", message: "Partida retirada; el requerimiento volvió a pendiente." }); }
  catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect(`/compras/listas/${listId}`);
}

export async function setShoppingListSupplierAction(formData: FormData) {
  const listId = requiredText(formData.get("listId"), "Lista");
  try { await setShoppingListSupplier(await guard("purchase.operate"), listId, optionalText(formData.get("supplierId"))); await setFlash({ tone: "ok", message: "Proveedor actualizado." }); }
  catch (error) { await setFlash({ tone: "error", message: bubble(error) }); }
  redirect(`/compras/listas/${listId}`);
}

export async function convertShoppingListAction(formData: FormData) {
  const listId = requiredText(formData.get("listId"), "Lista");
  try {
    const purchase = await convertShoppingListToPurchase(await guard("purchase.operate"), listId, convertShoppingListFinanceFromForm(formData));
    await setFlash({ tone: "ok", message: `${purchase.folio} creada desde la lista.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect(`/compras/listas/${listId}`);
  }
}

export type CreateShoppingListState =
  | { status: "idle" }
  | { status: "success"; listId: string }
  | { status: "error"; message: string };

export async function createShoppingListAction(
  _previousState: CreateShoppingListState,
  formData: FormData,
): Promise<CreateShoppingListState> {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const list = await createShoppingList(session, {
      kind: formData.get("kind") === "REFACCION" ? "REFACCION" : "GENERAL",
      supplierId: optionalText(formData.get("supplierId")),
    });
    await setFlash({ tone: "ok", message: `${list.folio} creada.` });
    revalidatePath("/compras/listas");
    return { status: "success", listId: list.id };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

export async function convertShoppingListOverlayAction(
  _previousState: RequirementOverlayState,
  formData: FormData,
): Promise<RequirementOverlayState> {
  "use server";
  const listId = requiredText(formData.get("listId"), "Lista");
  try {
    const purchase = await convertShoppingListToPurchase(await guard("purchase.operate"), listId, convertShoppingListFinanceFromForm(formData));
    await setFlash({ tone: "ok", message: `${purchase.folio} creada desde la lista.` });
    revalidatePath("/compras/listas");
    revalidatePath(`/compras/listas/${listId}`);
    return { status: "success", message: `${purchase.folio} registrada.` };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}
