import { controlClass } from "@/components/ui";
import { SAT_REGIMENES } from "@/lib/sat-regimen";

export function RegimenSelect({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={controlClass}>
      <option value="">Sin definir</option>
      {SAT_REGIMENES.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
