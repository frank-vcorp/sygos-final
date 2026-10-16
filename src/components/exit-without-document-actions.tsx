"use client";

import { authorizeExitWithoutDocumentAction, requestExitWithoutDocumentAction } from "@/app/(erp)/operacion/actions";
import { Button } from "@/components/ui";

export function RequestExitWithoutDocumentButton({
  caseId,
  version,
  pending,
  authorized,
}: {
  caseId: string;
  version: number;
  pending: boolean;
  authorized: boolean;
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
      <Button type="submit" tone="ghost">Solicitar salida sin documentos</Button>
    </form>
  );
}

export function AuthorizeExitWithoutDocumentButton({ caseId, version }: { caseId: string; version: number }) {
  return (
    <form action={authorizeExitWithoutDocumentAction} className="inline">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="version" value={version} />
      <Button type="submit" className="min-h-9 px-3 py-1.5 text-sm">Autorizar salida</Button>
    </form>
  );
}
