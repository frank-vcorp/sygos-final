import { controlClass } from "@/components/ui";
import { SAT_METODO_PAGO } from "@/lib/sat-payment-method";

export function PaymentMethodSelect({
  name,
  defaultValue,
  value,
  onChange,
  required = false,
}: {
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (next: string) => void;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      required={required}
      {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? "" })}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      className={controlClass}
    >
      <option value="">Sin definir</option>
      {SAT_METODO_PAGO.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
