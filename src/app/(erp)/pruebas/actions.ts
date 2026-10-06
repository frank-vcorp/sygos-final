"use server";

import { redirect } from "next/navigation";
import { activateSandbox, finishSandbox } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { requireSession } from "@/lib/session";

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo abrir la prueba.";
}

export async function startSandboxAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) throw new Error("Solo el administrador real abre el modo de pruebas.");
  try {
    const userIds = formData.getAll("userId").map(String).filter(Boolean);
    const roles = formData.getAll("role").map(String).filter(Boolean);
    await activateSandbox(userIds, roles);
    await setFlash({ tone: "ok", message: "Modo de pruebas activo. Los participantes trabajan sobre una copia." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/pruebas");
}

export async function finishSandboxAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (session.realRole !== "ADMINISTRADOR") throw new Error("Solo un administrador finaliza la prueba.");
  if (formData.get("confirm") !== "si") {
    await setFlash({ tone: "error", message: "Confirma que los cambios temporales se descartan para siempre." });
    redirect("/pruebas");
  }
  await finishSandbox();
  await setFlash({ tone: "ok", message: "La prueba terminó. Los participantes volvieron a producción." });
  redirect("/pruebas");
}
