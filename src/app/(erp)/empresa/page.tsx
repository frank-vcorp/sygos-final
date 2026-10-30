import { redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

export default async function EmpresaPage() {
  const session = await requireCompany();
  redirect(homePath(session.role, session.activeCompanyCode));
}
