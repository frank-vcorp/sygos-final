import { serviceSeries } from "@/lib/servicios-catalog";

/** Misma presentación que supervisor técnico (espera ingreso): DX/OS + leyenda de folio. */
export function EntradaServicioCell({ attentionType }: { attentionType: string | null }) {
  if (!attentionType) return <span className="text-sm text-[var(--muted)]">—</span>;
  const series = serviceSeries(attentionType);
  return (
    <>
      <span className="font-medium text-[var(--accent)]">{series}</span>
      <span className="block text-xs text-[var(--muted)]">
        Pendiente de ingreso físico · el folio {series} se genera al recibir
      </span>
    </>
  );
}
