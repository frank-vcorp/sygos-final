import { controlClass } from "@/components/ui";
import { SAT_PUE_PAYMENT_FORMS } from "@/lib/sat-payment-method";

export function PaymentFormSelect({
  name,
  paymentMethod,
  value,
  defaultValue = "03",
  onChange,
  required = false,
}: {
  name: string;
  paymentMethod?: string | null;
  value?: string;
  defaultValue?: string | null;
  onChange?: (next: string) => void;
  required?: boolean;
}) {
  if (paymentMethod === "PPD") {
    return (
      <>
        <input type="hidden" name={name} value="99" />
        <select disabled value="99" className={`${controlClass} bg-slate-100 text-slate-600`} aria-label="Forma de pago SAT">
          <option value="99">99 — Por definir (obligatorio en PPD)</option>
        </select>
      </>
    );
  }
  const current = value !== undefined ? value : (defaultValue && defaultValue !== "99" ? defaultValue : "03");
  return (
    <select
      name={name}
      required={required}
      {...(value !== undefined ? { value: current } : { defaultValue: current })}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      className={controlClass}
    >
      {SAT_PUE_PAYMENT_FORMS.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
