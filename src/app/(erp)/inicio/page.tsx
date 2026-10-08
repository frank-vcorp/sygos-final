import { redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { requireSession } from "@/lib/session";

/** Ruta legada: cada rol entra a su pantalla (panel, custodia, etc.). */
export default async function InicioPage() {
  const session = await requireSession();
  if (!session.activeCompanyId) redirect("/empresa");
  redirect(homePath(session.role, session.activeCompanyCode));
}
