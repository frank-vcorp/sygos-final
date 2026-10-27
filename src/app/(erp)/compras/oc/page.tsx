import { redirect } from "next/navigation";

export default function NuevaOrdenRedirectPage() {
  redirect("/compras?vista=oc&nueva=1");
}
