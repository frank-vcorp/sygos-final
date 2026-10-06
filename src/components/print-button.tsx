"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="mt-6 rounded-md border border-[var(--line)] px-3 py-2 print:hidden">
      Imprimir o guardar PDF
    </button>
  );
}
