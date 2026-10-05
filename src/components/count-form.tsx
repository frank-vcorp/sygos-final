"use client";

import { useActionState } from "react";
import { applyCountAction, previewCountAction, type CountPreview } from "@/app/(erp)/inventario/actions";
import { Button, controlClass } from "@/components/ui";

const empty: CountPreview = { rows: [], unknown: [] };

export function CountForm() {
  const [preview, action, pending] = useActionState(previewCountAction, empty);
  return (
    <div className="grid max-w-3xl gap-4">
      <form action={action} className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <label className="text-sm font-medium">Conteo
          <textarea name="conteo" required rows={8} placeholder={"numero,conteo\nAB-100,4"} className={`${controlClass} mt-1 font-mono`} />
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Comparando…" : "Previsualizar diferencias"}</Button>
      </form>
      {preview.error ? <p className="text-sm text-[var(--danger)]">{preview.error}</p> : null}
      {preview.unknown.length > 0 ? (
        <p className="text-sm text-[var(--danger)]">No están en el catálogo y no se crean solas: {preview.unknown.join(", ")}</p>
      ) : null}
      {preview.rows.length > 0 ? (
        <form action={applyCountAction} className="rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="conteo" value={preview.rows.map((row) => `${row.partNumber},${row.counted}`).join("\n")} />
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-1">Parte</th>
                <th className="py-1">Actual</th>
                <th className="py-1">Conteo</th>
                <th className="py-1">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.partNumber}>
                  <td className="py-1">{row.partNumber}</td>
                  <td className="py-1">{row.current}</td>
                  <td className="py-1">{row.counted}</td>
                  <td className="py-1">{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="submit" className="mt-3" disabled={preview.unknown.length > 0}>Aplicar conteo</Button>
        </form>
      ) : null}
    </div>
  );
}
