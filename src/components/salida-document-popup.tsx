"use client";

import { useEffect, useRef } from "react";

/** Abre el documento de salida en ventana nueva sin salir de la ficha del equipo. */
export function SalidaDocumentPopup({ movementId }: { movementId: string | null | undefined }) {
  const opened = useRef(false);

  useEffect(() => {
    if (!movementId || opened.current) return;
    opened.current = true;
    const url = `${window.location.origin}/documentos/salida/${movementId}`;
    window.open(url, "_blank", "noopener,noreferrer,width=980,height=900");
    const next = new URL(window.location.href);
    next.searchParams.delete("documentoSalida");
    const qs = next.searchParams.toString();
    window.history.replaceState({}, "", qs ? `${next.pathname}?${qs}` : next.pathname);
  }, [movementId]);

  return null;
}
