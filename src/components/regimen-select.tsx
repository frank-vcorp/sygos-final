import { controlClass } from "@/components/ui";
import { SAT_REGIMENES } from "@/lib/sat-regimen";

export function RegimenSelect({ name, defaultValue, required = false }: { name: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <select name={name} required={required} defaultValue={defaultValue ?? ""} className={controlClass}>
      <option value="">Sin definir</option>
      {SAT_REGIMENES.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
