import { redirect } from "next/navigation";
import {
  executeServiceFolioResetAction,
  refreshServiceFolioResetSnapshotAction,
} from "./actions";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  Badge,
  Button,
  controlClass,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  PageHeader,
} from "@/components/ui";
import { takeFlash } from "@/lib/flash";
import {
  looksLikeProductionDatabaseUrl,
  snapshotServiceFolioResetCounts,
} from "@/lib/reset-service-folios";
import { requireCompany } from "@/lib/session";

export default async function AdminMantenimientoPage() {
  const session = await requireCompany();
  if (session.realRole !== "ADMINISTRADOR" || session.impersonating) redirect("/inicio");

  const flash = await takeFlash();
  const counts = await snapshotServiceFolioResetCounts();
  const productionLike = looksLikeProductionDatabaseUrl(process.env.DATABASE_URL);

  return (
    <>
      <PageHeader
        title="Reinicio folios de servicio (staging)"
        subtitle="Herramienta destructiva para entornos de prueba. Borra DX, OS, cotizaciones de servicio, FAC y contadores SRV/DX/OS/COT/FAC/REM. No disponible en modo «ver como»."
      />

      <div className="mb-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
        <p className="font-semibold">Solo staging</p>
        <p className="mt-1 leading-6">
          Conserva usuarios, empresas, clientes, proveedores, inventario y filas de equipo (custodia se
          limpia). Equivalente a <code className="text-xs">scripts/reset-service-folios.mts</code>.
        </p>
        {productionLike ? (
          <p className="mt-2 font-medium text-red-800">
            DATABASE_URL parece producción: la ejecución desde esta pantalla está bloqueada.
          </p>
        ) : null}
      </div>

      <section className="mb-8 max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Conteos actuales</h2>
          {flash?.tone === "ok" && flash.message.startsWith("Reinicio completado") ? (
            <Badge tone="ok">Después del reinicio</Badge>
          ) : (
            <Badge tone="neutral">Simulación</Badge>
          )}
        </div>
        <pre className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(counts, null, 2)}
        </pre>
        <form action={refreshServiceFolioResetSnapshotAction} className="mt-3">
          <Button type="submit" tone="ghost">
            Simular
          </Button>
        </form>
      </section>

      <FormPanel action={executeServiceFolioResetAction} className="max-w-xl">
        <fieldset disabled={productionLike} className="min-w-0 border-0 p-0 m-0">
          <FormSection
            title="Ejecutar reinicio"
            description="Irreversible. Requiere escribir REINICIAR y confirmar el alcance."
            columns={1}
          >
            <Field label="Confirmación" hint='Escribe REINICIAR en mayúsculas.'>
              <input
                name="confirmText"
                required
                autoComplete="off"
                className={controlClass}
                placeholder="REINICIAR"
              />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="understand" value="si" required className="mt-1" />
              <span>Entiendo que borra DX/OS/COT/FAC de servicio (y datos ligados del ciclo).</span>
            </label>
          </FormSection>
          <FormActions>
            <ConfirmSubmit message="Se borrarán casos técnicos, cotizaciones de servicio, facturación y contadores de folio. ¿Continuar?">
              Ejecutar reinicio
            </ConfirmSubmit>
          </FormActions>
        </fieldset>
      </FormPanel>
    </>
  );
}
