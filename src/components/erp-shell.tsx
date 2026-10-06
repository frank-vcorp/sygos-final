"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SygosLogo } from "./brand-logo";

export function ErpShell({
  sidebar,
  toolbar,
  children,
}: {
  sidebar: React.ReactNode;
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div data-erp-shell className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <div data-erp-chrome className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--line)] bg-white px-4 md:hidden print:hidden">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[var(--line)] text-xl"
          aria-label="Abrir navegación"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
        <SygosLogo compact />
        <span className="w-11" aria-hidden />
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/35 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        data-erp-chrome
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] overflow-y-auto border-r border-[var(--line)] bg-white transition-transform md:sticky md:top-0 md:z-20 md:h-screen md:w-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegación principal"
      >
        <div className="flex justify-end p-2 md:hidden">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-2xl text-[var(--muted)]"
            aria-label="Cerrar navegación"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        {sidebar}
      </aside>

      <div className="min-w-0">
        <div data-erp-chrome className="print:hidden">{toolbar}</div>
        {children}
      </div>
    </div>
  );
}
