"use client";

import { useActionState } from "react";
import { applyCountAction, previewCountAction, type CountPreview } from "@/app/(erp)/inventario/actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

const empty: CountPreview = { rows: [], unknown: [], conteoPayload: "" };

export function CountForm() {
  const [preview, action, pending] = useActionState(previewCountAction, empty);
  return (
    <div className="grid max-w-3xl gap-4">
      <FormPanel action={action}>
        <FormSection title="Captura de conteo" description="Usa la columna id del CSV exportado; el nombre puede repetirse en varias ubicaciones." columns={1}>
          <Field label="Conteo">
            <textarea
              name="conteo"
              required
              rows={8}
              placeholder={"id,conteo\n(clmm…,4)"}
              className={`${controlClass} font-mono`}
            />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit" disabled={pending}>{pending ? "Comparando…" : "Previsualizar diferencias"}</Button>
        </FormActions>
      </FormPanel>
      {preview.error ? <p className="text-sm text-[var(--danger)]">{preview.error}</p> : null}
      {preview.unknown.length > 0 ? (
        <p className="text-sm text-[var(--danger)]">No están en el catálogo y no se crean solas: {preview.unknown.join(", ")}</p>
      ) : null}
      {preview.rows.length > 0 ? (
        <FormPanel action={applyCountAction}>
          <input type="hidden" name="conteo" value={preview.conteoPayload} />
          <FormSection title="Diferencias" description="Revisa antes de aplicar. Solo actualiza existencias ya registradas." columns={1}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="py-1">Producto</th>
                    <th className="py-1">Actual</th>
                    <th className="py-1">Conteo</th>
                    <th className="py-1">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.partId}>
                      <td className="py-1">{row.label}</td>
                      <td className="py-1">{row.current}</td>
                      <td className="py-1">{row.counted}</td>
                      <td className="py-1">{row.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
          <FormActions>
            <Button type="submit" disabled={preview.unknown.length > 0}>Aplicar conteo</Button>
          </FormActions>
        </FormPanel>
      ) : null}
    </div>
  );
}
