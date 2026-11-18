import {
  configureFacturapiWebhookAction,
  saveFacturapiAction,
  verifyFacturapiAction,
} from "@/app/(erp)/configuracion/actions";
import { Badge, Button, controlClass, Field, FormPanel, FormSection } from "@/components/ui";
import {
  FISCAL_OPERATION_KINDS,
  SAT_TAXABILITY_OPTIONS,
  SAT_UNIT_OPTIONS,
  type CompanyFiscalConfig,
  type FacturapiEnvExtra,
} from "@/lib/fiscal-config";

type EnvSlot = {
  hasSecret: boolean;
  secretHint: string | null;
  extra: FacturapiEnvExtra;
};

export function FacturapiSettingsCard({
  companyName,
  companyCode,
  config,
  testSlot,
  liveSlot,
  registroPatronal,
  employerCurp,
  employerState,
}: {
  companyName: string;
  companyCode: string;
  config: CompanyFiscalConfig;
  testSlot: EnvSlot;
  liveSlot: EnvSlot;
  registroPatronal: string | null;
  employerCurp: string | null;
  employerState: string | null;
}) {
  const modeBadge =
    config.facturapiMode === "LIVE"
      ? { label: "Producción · SAT Live", tone: "ok" as const }
      : config.facturapiMode === "TEST"
        ? { label: "Pruebas · Sandbox (sk_test_)", tone: "warn" as const }
        : { label: "Desactivado", tone: "neutral" as const };

  const activeExtra = config.facturapiMode === "LIVE" ? liveSlot.extra : testSlot.extra;
  const prodBadge = liveSlot.extra.isProductionReady
    ? { label: "Org Live lista (CSD + Manifiesto)", tone: "ok" as const }
    : liveSlot.hasSecret
      ? { label: "Org Live sin verificar / pendiente", tone: "warn" as const }
      : { label: "Sin llave Live", tone: "neutral" as const };

  return (
    <FormPanel id="facturapi" action={saveFacturapiAction} className="scroll-mt-28">
      <input type="hidden" name="returnTo" value="/configuracion/integraciones#facturapi" />

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-5 pt-5 pb-4 md:px-7">
        <div className="border-l-[3px] border-[#0e5696] pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">
              Facturapi · CFDI 4.0 ({companyName})
            </h3>
            <Badge tone={companyCode === "SERVOMOTORES" ? "warn" : "neutral"}>{companyCode}</Badge>
            <Badge tone={modeBadge.tone}>{modeBadge.label}</Badge>
            <Badge tone={prodBadge.tone}>{prodBadge.label}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            1 cuenta Facturapi con organizaciones independientes por empresa. El modo Pruebas usa{" "}
            <code>sk_test_</code> sin enviar al SAT; el modo de pruebas interno (<code>/pruebas</code>) siempre
            simula sin contactar a Facturapi.
          </p>
        </div>
      </div>

      <FormSection
        title="1. Ambiente, llaves y estado de organización"
        description="Guarda llaves independientes para Sandbox (sk_test_) y Producción (sk_live_). Dejar un campo vacío conserva el secreto ya guardado."
        columns={2}
      >
        <div className="md:col-span-2">
          <Field
            label="Modo de operación fiscal"
            hint="En staging usa TEST (sk_test_). Para activar LIVE se exige llave sk_live_ y organización lista en Facturapi (CSD + Carta Manifiesto)."
          >
            <select name="facturapiMode" defaultValue={config.facturapiMode} className={controlClass}>
              <option value="OFF">Desactivado (no timbra en Facturapi)</option>
              <option value="TEST">Pruebas / Sandbox (usa sk_test_ — sin validez SAT)</option>
              <option value="LIVE">Producción SAT (usa sk_live_ — validez fiscal oficial)</option>
            </select>
          </Field>
        </div>

        <Field
          label="Llave secreta Test (Sandbox)"
          hint={testSlot.secretHint ? `Guardada: ${testSlot.secretHint}` : "Inicia con sk_test_"}
        >
          <input
            name="testSecret"
            type="password"
            autoComplete="new-password"
            className={controlClass}
            placeholder={testSlot.secretHint ? `Conserva ${testSlot.secretHint}` : "sk_test_…"}
          />
        </Field>
        <Field
          label="Webhook Secret Test (opcional)"
          hint={
            testSlot.extra.webhookSecretHint
              ? `Guardado: ${testSlot.extra.webhookSecretHint}`
              : "Secreto de firma Facturapi-Signature para ambiente Test."
          }
        >
          <input
            name="testWebhookSecret"
            type="password"
            autoComplete="new-password"
            className={controlClass}
            placeholder={testSlot.extra.webhookSecretHint ? `Conserva ${testSlot.extra.webhookSecretHint}` : "whsec_…"}
          />
        </Field>

        <Field
          label="Llave secreta Live (Producción SAT)"
          hint={liveSlot.secretHint ? `Guardada: ${liveSlot.secretHint}` : "Inicia con sk_live_"}
        >
          <input
            name="liveSecret"
            type="password"
            autoComplete="new-password"
            className={controlClass}
            placeholder={liveSlot.secretHint ? `Conserva ${liveSlot.secretHint}` : "sk_live_…"}
          />
        </Field>
        <Field
          label="Webhook Secret Live (opcional)"
          hint={
            liveSlot.extra.webhookSecretHint
              ? `Guardado: ${liveSlot.extra.webhookSecretHint}`
              : "Secreto de firma Facturapi-Signature para ambiente Live."
          }
        >
          <input
            name="liveWebhookSecret"
            type="password"
            autoComplete="new-password"
            className={controlClass}
            placeholder={liveSlot.extra.webhookSecretHint ? `Conserva ${liveSlot.extra.webhookSecretHint}` : "whsec_…"}
          />
        </Field>

        <div className="md:col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">Diagnóstico de Organización / CSD / Carta Manifiesto</p>
              <p className="mt-0.5 text-slate-600">
                {activeExtra.organizationId
                  ? `Org ID: ${activeExtra.organizationId}${activeExtra.taxId ? ` · RFC ${activeExtra.taxId}` : ""}${activeExtra.organizationName ? ` · ${activeExtra.organizationName}` : ""}`
                  : "Aún no se ha verificado la organización contra Facturapi."}
              </p>
              {liveSlot.extra.organizationId ? (
                <p className="mt-1 text-slate-600">
                  CSD Live: {liveSlot.extra.hasCertificate ? `Cargado (serie ${liveSlot.extra.certificateSerial ?? "—"})` : "No cargado"}
                  {liveSlot.extra.certificateExpiresAt ? ` · vence ${liveSlot.extra.certificateExpiresAt.slice(0, 10)}` : ""}
                  {" · "}
                  Producción: {liveSlot.extra.isProductionReady ? "Lista" : "Pendiente"}
                </p>
              ) : null}
              {liveSlot.extra.pendingSteps && liveSlot.extra.pendingSteps.length > 0 ? (
                <p className="mt-1 font-medium text-amber-800">
                  Pasos pendientes en Facturapi: {liveSlot.extra.pendingSteps.join(" · ")}
                </p>
              ) : null}
              <p className="mt-1 text-slate-600">
                Webhook Test: {testSlot.extra.webhookId ? `Activo (${testSlot.extra.webhookUrl ?? testSlot.extra.webhookId})` : "Sin configurar"}
                {" · "}
                Webhook Live: {liveSlot.extra.webhookId ? `Activo (${liveSlot.extra.webhookUrl ?? liveSlot.extra.webhookId})` : "Sin configurar"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" formAction={verifyFacturapiAction} name="verifyTarget" value="TEST" tone="ghost">
                Verificar Test
              </Button>
              <Button type="submit" formAction={verifyFacturapiAction} name="verifyTarget" value="LIVE" tone="ghost">
                Verificar organización y CSD (Live)
              </Button>
              <Button type="submit" formAction={configureFacturapiWebhookAction} name="webhookTarget" value="TEST" tone="ghost">
                Configurar / verificar webhook Test
              </Button>
              <Button type="submit" formAction={configureFacturapiWebhookAction} name="webhookTarget" value="LIVE" tone="ghost">
                Configurar / verificar webhook Live
              </Button>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="2. Política de serie, folio y desglose de partidas"
        description="Define si los CFDI imprimen el folio interno de SYGOS (FAC-n) y si las cotizaciones pasan línea por línea."
        columns={3}
      >
        <Field label="Serie y folio en CFDI">
          <select name="fiscalSeriesPolicy" defaultValue={config.fiscalSeriesPolicy} className={controlClass}>
            <option value="SYGOS_FAC">Usar serie y folio de SYGOS (FAC-n)</option>
            <option value="FACTURAPI_AUTO">Usar autoincremental interno de Facturapi</option>
          </select>
        </Field>
        <Field label="Serie fiscal por defecto" hint="Usada cuando el folio no especifica prefijo.">
          <input name="fiscalDefaultSeries" defaultValue={config.fiscalDefaultSeries} className={controlClass} />
        </Field>
        <Field label="Partidas desde cotización">
          <select name="fiscalLineMode" defaultValue={config.fiscalLineMode} className={controlClass}>
            <option value="LINE_BY_LINE">Línea por línea de cotización (recomendado)</option>
            <option value="CONSOLIDATED">Partida única consolidada</option>
          </select>
        </Field>
      </FormSection>

      <FormSection
        title="3. Claves SAT por defecto (c_ClaveProdServ, c_ClaveUnidad, ObjetoImp)"
        description="Valores iniciales editables por tipo de operación para esta empresa."
        columns={1}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Tipo de operación</th>
                <th className="px-3 py-2 font-semibold">Clave Prod/Serv (8 dígitos)</th>
                <th className="px-3 py-2 font-semibold">Unidad SAT</th>
                <th className="px-3 py-2 font-semibold">Nombre unidad</th>
                <th className="px-3 py-2 font-semibold">ObjetoImp SAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 bg-white">
              {FISCAL_OPERATION_KINDS.map((op) => {
                const current = config.satDefaults[op.key];
                return (
                  <tr key={op.key}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-semibold text-slate-900">{op.label}</p>
                      <p className="text-[11px] text-slate-500">{op.hint}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <input
                        name={`sat_${op.key}_productKey`}
                        defaultValue={current.productKey}
                        maxLength={8}
                        className={`${controlClass} min-w-28`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <select
                        name={`sat_${op.key}_unitKey`}
                        defaultValue={current.unitKey}
                        className={`${controlClass} min-w-36`}
                      >
                        {SAT_UNIT_OPTIONS.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <input
                        name={`sat_${op.key}_unitName`}
                        defaultValue={current.unitName}
                        maxLength={20}
                        className={`${controlClass} min-w-28`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <select
                        name={`sat_${op.key}_taxability`}
                        defaultValue={current.taxability}
                        className={`${controlClass} min-w-44`}
                      >
                        {SAT_TAXABILITY_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection
        title="4. Operación y automatización (Fases posteriores y reglas)"
        description="Por defecto los envíos y complementos de pago (REP) operan mediante botón manual."
        columns={2}
      >
        <Field label="Envío por correo al timbrar (SendGrid)">
          <select
            name="autoEmailOnStamp"
            defaultValue={config.toggles.autoEmailOnStamp ? "auto" : "manual"}
            className={controlClass}
          >
            <option value="manual">Manual (botón en detalle)</option>
            <option value="auto">Automático al timbrar</option>
          </select>
        </Field>
        <Field label="Envío por WhatsApp (Baileys)">
          <select
            name="autoWhatsAppOnStamp"
            defaultValue={config.toggles.autoWhatsAppOnStamp ? "auto" : "manual"}
            className={controlClass}
          >
            <option value="manual">Manual (botón en detalle)</option>
            <option value="auto">Automático al timbrar</option>
          </select>
        </Field>
        <Field label="Timbrado de Complemento de Pago (REP · PPD)">
          <select
            name="autoRepOnPaymentValidation"
            defaultValue={config.toggles.autoRepOnPaymentValidation ? "auto" : "manual"}
            className={controlClass}
          >
            <option value="manual">Manual (botón en pago validado)</option>
            <option value="auto">Automático al validar pago</option>
          </select>
        </Field>
        <Field label="Cancelación con pagos / REP aplicados">
          <select
            name="cancelWithPaymentsPolicy"
            defaultValue={config.toggles.cancelWithPaymentsPolicy}
            className={controlClass}
          >
            <option value="BLOCK_UNTIL_REP_CANCELED">Bloquear hasta cancelar REP y pago primero</option>
            <option value="ALLOW_GUIDED_SUBSTITUTION">Flujo guiado de sustitución (Motivo 01)</option>
          </select>
        </Field>
      </FormSection>

      <FormSection
        title="5. Datos patronales (CFDI Nómina)"
        description="Requeridos para timbrar recibos de nómina de esta empresa."
        columns={3}
      >
        <Field label="Registro patronal">
          <input name="registroPatronal" defaultValue={registroPatronal ?? ""} className={controlClass} />
        </Field>
        <Field label="CURP del patrón">
          <input name="employerCurp" defaultValue={employerCurp ?? ""} className={controlClass} />
        </Field>
        <Field label="Entidad federativa">
          <input name="employerState" defaultValue={employerState ?? ""} className={controlClass} placeholder="MEX" />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-4 md:px-7">
        <Button type="submit">Guardar Facturapi</Button>
      </div>
    </FormPanel>
  );
}
