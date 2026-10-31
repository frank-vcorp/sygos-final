import { redirect } from "next/navigation";

export default async function CatalogosFinancierosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("vista", "catalogos");
  for (const key of ["q", "tipo", "estado", "id", "clase"] as const) {
    const value = sp[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  redirect(`/configuracion/finanzas?${params.toString()}`);
}
