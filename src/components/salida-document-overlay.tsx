"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";

/** Ventana emergente con el documento de salida; la ficha del equipo queda detrás. */
export function SalidaDocumentOverlay({ movementId }: { movementId: string | null | undefined }) {
  const [open, setOpen] = useState(Boolean(movementId));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setOpen(Boolean(movementId));
  }, [movementId]);

  const close = useCallback(() => {
    setOpen(false);
    const next = new URL(window.location.href);
    next.searchParams.delete("documentoSalida");
    const qs = next.searchParams.toString();
    window.history.replaceState({}, "", qs ? `${next.pathname}?${qs}` : next.pathname);
  }, []);

  const printDocument = () => {
    const frame = iframeRef.current?.contentWindow;
    if (frame) frame.print();
  };

  if (!movementId) return null;

  return (
    <FormOverlayDialog
      open={open}
      onClose={close}
      title="Documento de salida"
      titleId="salida-documento-overlay"
      documentWide
    >
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={printDocument}>Imprimir</Button>
        <Button type="button" tone="ghost" onClick={close}>Cerrar y seguir en la ficha</Button>
      </div>
      <iframe
        ref={iframeRef}
        src={`/documentos/salida/${movementId}`}
        title="Documento de salida"
        className="h-[min(72vh,640px)] w-full rounded-md border border-[var(--line)] bg-white"
      />
    </FormOverlayDialog>
  );
}
