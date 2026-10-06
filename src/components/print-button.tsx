"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-white print:hidden">
      Imprimir o guardar PDF
    </button>
  );
}
