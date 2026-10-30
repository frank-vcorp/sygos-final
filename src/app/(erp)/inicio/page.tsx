import { redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

/** Ruta legada: cada rol entra a su pantalla (panel, custodia, etc.). */
export default async function InicioPage() {
  const session = await requireCompany();
  redirect(homePath(session.role, session.activeCompanyCode));
}
