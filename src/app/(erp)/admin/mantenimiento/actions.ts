"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import {
  ServiceFolioResetBlockedError,
  executeServiceFolioReset,
  looksLikeProductionDatabaseUrl,
  snapshotServiceFolioResetCounts,
} from "@/lib/reset-service-folios";
import { requireCompany } from "@/lib/session";

const PATH = "/admin/mantenimiento";

function bubble(error: unknown) {
  const redirecting =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  if (error instanceof ServiceFolioResetBlockedError) return error.message;
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

function assertAdminMaintenance(session: Awaited<ReturnType<typeof requireCompany>>) {
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) {
    throw new Error("Solo el administrador real puede usar herramientas de mantenimiento.");
  }
}

export async function refreshServiceFolioResetSnapshotAction() {
  "use server";
  const session = await requireCompany();
  try {
    assertAdminMaintenance(session);
    await snapshotServiceFolioResetCounts();
    await setFlash({ tone: "ok", message: "Conteos actualizados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  revalidatePath(PATH);
  redirect(PATH);
}

export async function executeServiceFolioResetAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  try {
    assertAdminMaintenance(session);
    if (formData.get("understand") !== "si") {
      throw new Error("Marca la casilla de confirmación.");
    }
    const typed = requiredText(formData.get("confirmText"), "Confirmación");
    if (typed !== "REINICIAR") {
      throw new Error('Escribe exactamente REINICIAR para confirmar.');
    }
    if (looksLikeProductionDatabaseUrl(process.env.DATABASE_URL)) {
      throw new ServiceFolioResetBlockedError(
        "DATABASE_URL parece producción. Usa el script con --i-know si es imprescindible.",
      );
    }
    const after = await executeServiceFolioReset({ allowProduction: false });
    await setFlash({
      tone: "ok",
      message: `Reinicio completado. Casos técnicos: ${after.technicalCase}, cotizaciones servicio: ${after.serviceQuotes}, documentos FAC: ${after.billingDocument}.`,
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  revalidatePath(PATH);
  redirect(PATH);
}
