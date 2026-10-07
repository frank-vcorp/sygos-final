"use server";

import { redirect } from "next/navigation";
import { MOVEMENTS, type MovementKind } from "@/lib/custody";
import { cancelMovement, createAttention, createEqui, createMot, registerMovement } from "@/lib/equipment-service";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm, supplierIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para esta acción." });
    redirect("/inicio");
  }
  return session;
}

function whenOf(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  if (!text) return new Date();
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha no es válida.");
  return date;
}

export async function createEquiAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("equi.create");
    const { clientId } = await clientIdFromForm(session, formData);
    const equipment = await createEqui(session, {
      clientId,
      typeName: optionalText(formData.get("newType")) ?? requiredText(formData.get("typeName"), "Tipo"),
      brandName: optionalText(formData.get("newBrand")) ?? requiredText(formData.get("brandName"), "Marca"),
      model: requiredText(formData.get("model"), "Modelo"),
      description: optionalText(formData.get("description")),
      serial: optionalText(formData.get("serial")),
    });
    await setFlash({ tone: "ok", message: `${equipment.folio} quedó registrado. El SLA inicia cuando se confirme la entrada física.` });
    redirect(`/equipos/${equipment.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/equipos/nuevo");
  }
}

export async function createMotAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("mot.create");
    const { clientId } = await clientIdFromForm(session, formData);
    const equipment = await createMot(session, {
      clientId,
      typeName: optionalText(formData.get("newType")) ?? requiredText(formData.get("typeName"), "Tipo"),
      brand: optionalText(formData.get("newBrand")) ?? requiredText(formData.get("brandName"), "Marca"),
      model: requiredText(formData.get("model"), "Modelo"),
      description: optionalText(formData.get("description")),
      serial: optionalText(formData.get("serial")),
      attentionType: requiredText(formData.get("attentionType"), "Tipo de atención"),
      priorityId: requiredText(formData.get("priorityId"), "Prioridad"),
      reportedFault: requiredText(formData.get("reportedFault"), "Falla reportada"),
      antecedent: optionalText(formData.get("antecedent")),
      deliveryInstructions: optionalText(formData.get("deliveryInstructions")),
    });
    await setFlash({ tone: "ok", message: `${equipment.folio} quedó registrado. El ingreso físico todavía está pendiente.` });
    redirect(`/motores/${equipment.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/motores/nuevo");
  }
}

export async function createAttentionAction(formData: FormData) {
  "use server";
  const equipmentId = String(formData.get("equipmentId") ?? "");
  const kind = formData.get("kind") === "MOT" ? "MOT" : "EQUI";
  const back = equipmentId ? (kind === "MOT" ? `/motores/${equipmentId}` : `/equipos/${equipmentId}`) : "/inicio";
  try {
    const session = await guard("attention.create");
    await createAttention(session, {
      equipmentId: requiredText(formData.get("equipmentId"), "Equipo"),
      attentionType: requiredText(formData.get("attentionType"), "Tipo de atención"),
      priorityId: requiredText(formData.get("priorityId"), "Prioridad"),
      reportedFault: requiredText(formData.get("reportedFault"), "Falla reportada"),
      antecedent: optionalText(formData.get("antecedent")),
      deliveryInstructions: optionalText(formData.get("deliveryInstructions")),
      originalCaseId: optionalText(formData.get("originalCaseId")),
      version: parseVersion(formData.get("version")),
    });
    await setFlash({ tone: "ok", message: "Atención creada. El SLA inicia con la recepción física." });
    redirect(back);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(back);
  }
}

export async function movementAction(formData: FormData) {
  "use server";
  const equipmentId = String(formData.get("equipmentId") ?? "");
  const kindName = formData.get("kind") === "MOT" ? "MOT" : "EQUI";
  const back = equipmentId ? (kindName === "MOT" ? `/motores/${equipmentId}` : `/equipos/${equipmentId}`) : "/custodia";
  try {
    const session = await guard("custody.confirm");
    const movement = requiredText(formData.get("movement"), "Movimiento");
    if (!(MOVEMENTS as readonly string[]).includes(movement)) throw new Error("Movimiento no reconocido.");
    await registerMovement(session, {
      equipmentId,
      version: parseVersion(formData.get("version")),
      kind: movement as MovementKind,
      reason: requiredText(formData.get("reason"), "Motivo"),
      occurredAt: whenOf(formData.get("occurredAt")),
      receiverName: optionalText(formData.get("receiverName")),
      deliveryMode: optionalText(formData.get("deliveryMode")),
      contact: optionalText(formData.get("contact")),
      enablingDocument: optionalText(formData.get("enablingDocument")),
      supplierId: await supplierIdFromForm(session, formData),
      notes: optionalText(formData.get("notes")),
    });
    await setFlash({ tone: "ok", message: "Movimiento físico registrado." });
    redirect(back);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(back);
  }
}

export async function cancelMovementAction(formData: FormData) {
  "use server";
  const equipmentId = String(formData.get("equipmentId") ?? "");
  const kindName = formData.get("kind") === "MOT" ? "MOT" : "EQUI";
  const back = equipmentId ? (kindName === "MOT" ? `/motores/${equipmentId}` : `/equipos/${equipmentId}`) : "/custodia";
  try {
    const session = await guard("custody.confirm");
    await cancelMovement(session, requiredText(formData.get("movementId"), "Movimiento"), requiredText(formData.get("cancelReason"), "Motivo de cancelación"));
    await setFlash({ tone: "ok", message: "Movimiento cancelado." });
    redirect(back);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(back);
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
