import type { ReactNode } from "react";

export type CommercialLineRow = {
  id: string;
  concept: ReactNode;
  quantity: number | string;
  unitPrice: string;
  amount: string;
};

export type FiscalLineRow = CommercialLineRow & {
  discount: string;
  satDetail: string;
};

export function DocumentLinesTableCommercial({ lines }: { lines: CommercialLineRow[] }) {
  return (
    <table className="mt-6 w-full text-left">
      <thead>
        <tr className="bg-[var(--accent)] text-white">
          <th className="px-3 py-2.5">Concepto</th>
          <th className="w-24 px-3 py-2.5 text-center">Cantidad</th>
          <th className="w-36 px-3 py-2.5 text-right">Precio unitario</th>
          <th className="w-36 px-3 py-2.5 text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-[var(--line)]">
            <td className="px-3 py-3">{line.concept}</td>
            <td className="px-3 py-3 text-center">{line.quantity}</td>
            <td className="px-3 py-3 text-right">{line.unitPrice}</td>
            <td className="px-3 py-3 text-right font-medium">{line.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocumentLinesTableFiscal({ lines }: { lines: FiscalLineRow[] }) {
  return (
    <table className="mt-6 w-full text-left">
      <thead>
        <tr className="bg-[var(--accent)] text-white">
          <th className="px-3 py-2.5">Concepto</th>
          <th className="w-16 px-3 py-2.5 text-center">Cant.</th>
          <th className="w-28 px-3 py-2.5 text-right">P. unit.</th>
          <th className="w-24 px-3 py-2.5 text-right">Descuento</th>
          <th className="w-32 px-3 py-2.5 text-left">Clave SAT</th>
          <th className="w-28 px-3 py-2.5 text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-[var(--line)]">
            <td className="px-3 py-3">{line.concept}</td>
            <td className="px-3 py-3 text-center">{line.quantity}</td>
            <td className="px-3 py-3 text-right">{line.unitPrice}</td>
            <td className="px-3 py-3 text-right">{line.discount}</td>
            <td className="px-3 py-3 text-xs text-[var(--muted)]">{line.satDetail}</td>
            <td className="px-3 py-3 text-right font-medium">{line.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}