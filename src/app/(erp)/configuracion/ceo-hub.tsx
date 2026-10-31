import Link from "next/link";
import { PageHeader } from "@/components/ui";

const BLOCKS = [
  {
    href: "/configuracion/finanzas",
    title: "Finanzas",
    body: "Cuentas y catálogos de ingreso, egreso y subcategorías.",
  },
  {
    href: "/configuracion/actividades",
    title: "Comercial",
    body: "Tipos de actividad comercial que usa la agenda.",
  },
  {
    href: "/configuracion/prioridades",
    title: "Operación técnica",
    body: "Prioridades de diagnóstico y de reparación / OS, por separado.",
  },
  {
    href: "/configuracion/presupuestos",
    title: "Compras",
    body: "Metas del mes y presupuestos de refacciones y generales.",
  },
] as const;

export function CeoConfigHub({ companyName }: { companyName: string }) {
  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle={`${companyName} · Elige una sección. Usuarios sigue en el menú.`}
      />
      <section className="grid gap-3 sm:grid-cols-2">
        {BLOCKS.map((block) => (
          <Link
            key={block.href}
            href={block.href}
            className="group block rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            <h2 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-[#0a477e]">{block.title}</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{block.body}</p>
            <p className="mt-4 text-xs font-semibold text-[#0a477e]">Abrir</p>
          </Link>
        ))}
      </section>
    </>
  );
}
