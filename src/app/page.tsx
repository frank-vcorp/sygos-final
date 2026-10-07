import { redirect } from "next/navigation";
import { homePath } from "@/lib/home";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  redirect(session ? homePath(session.role, session.activeCompanyCode) : "/login");
}
