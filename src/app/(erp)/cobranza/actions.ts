"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
import { addCollectionNote } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export async function collectionNoteAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("receivableId"), "Cuenta");
  try {
    const session = await requireCompany();
    if (!can(session.role, "receivable.view", session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
    const follow = optionalText(formData.get("followUpAt"));
    await addCollectionNote(session, id, requiredText(formData.get("note"), "Nota"), follow ? new Date(follow) : null);
    await setFlash({ tone: "ok", message: "Seguimiento registrado. No se creó un recordatorio automático." });
  } catch (error) {
    const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
    if (redirecting) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
  }
  redirect(`/cobranza/${id}`);
}
