export default async function NuevaCompraPage() {
  const { redirect } = await import("next/navigation");
  redirect("/compras/listas");
}
