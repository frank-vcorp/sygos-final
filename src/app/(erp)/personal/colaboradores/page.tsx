import { redirect } from "next/navigation";

export default async function PersonalColaboradoresRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string" && val) query.set(key, val);
  }
  const qs = query.toString();
  redirect(qs ? `/personal?${qs}` : "/personal");
}
