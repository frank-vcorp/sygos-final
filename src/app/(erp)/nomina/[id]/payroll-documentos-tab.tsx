"use client";

import { useState } from "react";
import { payrollDocumentAction } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, Card, controlClass, Empty, Field, recordLinkClass, Table, Td, Th } from "@/components/ui";

export type PayrollDocItem = {
  id: string;
  title: string;
};

export function PayrollDocumentosTab({
  periodId,
  documents,
}: {
  periodId: string;
  documents: PayrollDocItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Documentos de la nómina</h2>
          <p className="text-xs text-slate-500">
            Haz clic en el nombre del documento para consultarlo o descargarlo.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Subir documento
        </Button>
      </div>

      <Card className="p-5">
        {documents.length === 0 ? (
          <Empty
            title="Sin documentos"
            body="Aún no se han subido documentos o comprobantes para esta nómina."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <Td>
                    <a
                      href={`/nomina/documentos/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={recordLinkClass}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden
                      >
                        <path d="M4.5 2.5h4.75L12.5 5.75v7.25a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z" />
                        <path d="M9 2.5v3.5h3.5" />
                      </svg>
                      <span>{doc.title}</span>
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Subir documento a la nómina"
        titleId="modal-subir-documento-nomina"
      >
        <form action={payrollDocumentAction} className="space-y-4">
          <input type="hidden" name="periodId" value={periodId} />
          <Field label="Nombre">
            <input
              name="title"
              required
              placeholder="Ej. Comprobante de dispersión bancaria"
              className={controlClass}
            />
          </Field>
          <Field label="Archivo">
            <input name="file" type="file" required className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Subir documento</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </div>
  );
}
