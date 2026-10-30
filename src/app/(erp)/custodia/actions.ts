"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { parseVersion, requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import {
  issuePartRequest,
  markPartRequestNotFoundInWarehouse,
  receivePartRequest,
  receivePurchasePackageForAlmacen,
} from "@/lib/technical";

const TARGET_HREF = "/custodia#refacciones-almacen";

async function guardAlmacenRefacciones() {
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode) && session.role !== "ALMACEN") {
    throw new Error("No tienes permiso para operar refacciones de almacén en esta empresa.");
  }
  return session;
}

function isRedirect(error: unknown) {
  return (
    typeof error === "object"
    && error !== null
    && "digest" in error
    && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function revalidateAllRefaccionesPaths(caseId?: string) {
  revalidatePath("/custodia");
  revalidatePath("/panel");
  revalidatePath("/compras/requerimientos");
  revalidatePath("/inventario");
  if (caseId) revalidatePath(`/operacion/${caseId}`);
}

export async function almacenIssuePartRequestAction(formData: FormData) {
  "use server";
  try {
    const session = await guardAlmacenRefacciones();
    const requestId = requiredText(formData.get("requestId"), "Solicitud");
    const version = parseVersion(formData.get("version"));
    const quantity = Number(formData.get("quantity"));
    const caseId = String(formData.get("caseId") ?? "");
    await issuePartRequest(session, requestId, version, quantity);
    revalidateAllRefaccionesPaths(caseId || undefined);
    await setFlash({ tone: "ok", message: "Refacción marcada como surtida al técnico." });
    redirect(TARGET_HREF);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo registrar el surtido." });
    redirect(TARGET_HREF);
  }
}

export async function almacenPartNotFoundAction(formData: FormData) {
  "use server";
  try {
    const session = await guardAlmacenRefacciones();
    const requestId = requiredText(formData.get("requestId"), "Solicitud");
    const version = parseVersion(formData.get("version"));
    const result = await markPartRequestNotFoundInWarehouse(session, requestId, version);
    revalidateAllRefaccionesPaths(result.caseId);
    await setFlash({
      tone: "ok",
      message: `No encontrada en estante: se liberaron ${result.releasedQty} pza(s) y se envió requerimiento de compra (${result.shortfall} pza(s)) a Gerencia Operativa.`,
    });
    redirect(TARGET_HREF);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo liberar el apartado." });
    redirect(TARGET_HREF);
  }
}

export async function almacenReceivePurchasePackageAction(formData: FormData) {
  "use server";
  try {
    const session = await guardAlmacenRefacciones();
    const purchaseId = requiredText(formData.get("purchaseId"), "Compra");
    const result = await receivePurchasePackageForAlmacen(session, purchaseId);
    revalidateAllRefaccionesPaths();
    await setFlash({
      tone: "ok",
      message: `Paquete ${result.folio} ingresado a almacén (${result.receivedRequests} partida(s), ${result.totalUnits} pza(s)). Ya están en «Por surtir a técnicos».`,
    });
    redirect(TARGET_HREF);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo ingresar el paquete." });
    redirect(TARGET_HREF);
  }
}

export async function almacenReceivePartRequestAction(formData: FormData) {
  "use server";
  try {
    const session = await guardAlmacenRefacciones();
    const requestId = requiredText(formData.get("requestId"), "Solicitud");
    const version = parseVersion(formData.get("version"));
    const quantity = Number(formData.get("quantity"));
    const caseId = String(formData.get("caseId") ?? "");
    await receivePartRequest(session, requestId, version, quantity);
    revalidateAllRefaccionesPaths(caseId || undefined);
    await setFlash({
      tone: "ok",
      message: "Partida ingresada a almacén y lista en «Por surtir a técnicos».",
    });
    redirect(TARGET_HREF);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo ingresar la partida." });
    redirect(TARGET_HREF);
  }
}
