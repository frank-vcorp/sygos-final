import { controlClass } from "@/components/ui";
import { SAT_METODO_PAGO } from "@/lib/sat-payment-method";

export function PaymentMethodSelect({ name, defaultValue, required = false }: { name: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <select name={name} required={required} defaultValue={defaultValue ?? ""} className={controlClass}>
      <option value="">Sin definir</option>
      {SAT_METODO_PAGO.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
