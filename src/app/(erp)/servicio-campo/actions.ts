"use server";

import { redirect } from "next/navigation";
import { requestFromFieldServiceCase } from "@/lib/billing";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para esta acción." });
    redirect("/servicio-campo");
  }
  return session;
}

export async function requestFieldServiceDocumentAction(formData: FormData) {
  const fieldServiceCaseId = String(formData.get("fieldServiceCaseId") ?? "");
  try {
    const session = await guard("invoice.request");
    const kind = formData.get("kind") === "REMISION" ? "REMISION" : "FACTURA";
    const document = await requestFromFieldServiceCase(
      session,
      requiredText(fieldServiceCaseId, "Servicio de campo"),
      kind,
      null,
    );
    await setFlash({ tone: "ok", message: `${document.folio} quedó solicitado.` });
    redirect(`/facturacion/${document.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo solicitar el documento." });
    redirect(fieldServiceCaseId ? `/servicio-campo/${fieldServiceCaseId}` : "/servicio-campo");
  }
}
