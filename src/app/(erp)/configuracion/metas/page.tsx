import { redirect } from "next/navigation";
import { formatYearMonth, parseYearMonth } from "@/lib/ceo-config";

export default async function MetasConfigPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const period = parseYearMonth(mes);
  redirect(period ? `/configuracion/presupuestos?mes=${formatYearMonth(period.year, period.month)}` : "/configuracion/presupuestos");
}
