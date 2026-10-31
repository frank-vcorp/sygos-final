import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/session";

export async function requireCeoConfig() {
  const session = await requireCompany();
  if (session.role !== "CEO") redirect("/inicio");
  return session;
}
