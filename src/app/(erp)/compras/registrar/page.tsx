import { redirect } from "next/navigation";

export default function RegistrarCompraPage() {
  redirect("/compras?registrar=1");
}
