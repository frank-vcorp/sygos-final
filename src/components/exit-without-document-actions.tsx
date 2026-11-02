"use client";

import { authorizeExitWithoutDocumentAction, requestExitWithoutDocumentAction } from "@/app/(erp)/operacion/actions";
import { Button } from "@/components/ui";

export function RequestExitWithoutDocumentButton({
  caseId,
  version,
  pending,
  authorized,
  returnTo,
  label = "Solicitar salida sin documentos",
}: {
  caseId: string;
  version: number;
  pending: boolean;
  authorized: boolean;
  returnTo?: string;
  label?: string;
}) {
  if (authorized) {
    return <p className="text-sm text-[var(--ok)]">Salida sin documento autorizada por el CEO. Almacén ya puede registrar la entrega.</p>;
  }
  if (pending) {
    return <p className="text-sm text-[var(--muted)]">Solicitud enviada al CEO. Espera la autorización para que almacén registre la salida.</p>;
  }
  return (
    <form action={requestExitWithoutDocumentAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="version" value={version} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <Button type="submit" tone="ghost">{label}</Button>
    </form>
  );
}

export function AuthorizeExitWithoutDocumentButton({
  caseId,
  version,
  returnTo,
}: {
  caseId: string;
  version: number;
  returnTo?: string;
}) {
  return (
    <form action={authorizeExitWithoutDocumentAction} className="inline">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="version" value={version} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <Button type="submit" className="min-h-9 px-3 py-1.5 text-sm">Autorizar salida</Button>
    </form>
  );
}
