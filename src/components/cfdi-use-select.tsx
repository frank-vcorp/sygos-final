import { controlClass } from "@/components/ui";
import { SAT_USO_CFDI } from "@/lib/sat-cfdi-use";

export function CfdiUseSelect({ name, defaultValue, required = false }: { name: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <select name={name} required={required} defaultValue={defaultValue ?? ""} className={controlClass}>
      <option value="">Sin definir</option>
      {SAT_USO_CFDI.map((row) => (
        <option key={row.id} value={row.id}>
          {row.id} — {row.descripcion}
        </option>
      ))}
    </select>
  );
}
