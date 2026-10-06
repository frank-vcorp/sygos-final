"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { punch } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";

export async function punchAction(formData: FormData) {
  "use server";
  try {
    const session = await requireCompany();
    if (!can(session.role, "kiosk.punch")) throw new Error("El marcaje sale del kiosco.");
    await punch(session, requiredText(formData.get("collaboratorId"), "Colaborador"), formData.get("kind") === "SALIDA" ? "SALIDA" : "ENTRADA");
    await setFlash({ tone: "ok", message: "Marcaje registrado." });
  } catch (error) {
    const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
    if (redirecting) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo marcar." });
  }
  redirect("/kiosco");
}
