"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("sygos_sidebar_collapsed") === "si");
  }, []);
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

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sygos_sidebar_collapsed", next ? "si" : "no");
      return next;
    });
  }

  return (
    <div
      data-erp-shell
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      className={`min-h-screen md:grid ${collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[280px_minmax(0,1fr)]"}`}
    >
      <div data-erp-chrome className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md md:hidden print:hidden">
        <button
          type="button"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-lg text-slate-700 shadow-2xs hover:bg-slate-50"
          aria-label="Abrir navegación"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
        <span className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0a477e] text-[11px] font-bold text-white shadow-2xs">
            S
          </span>
          SYGOS
        </span>
        <span className="w-10" aria-hidden />
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        data-erp-chrome
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] overflow-y-auto border-r border-slate-200/80 bg-[#f7f8fa] text-slate-800 shadow-xl transition-[transform,width] md:sticky md:top-0 md:z-20 md:h-screen md:w-auto md:translate-x-0 md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegación principal"
      >
        <div className="flex justify-end p-2 md:hidden">
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
            aria-label="Cerrar navegación"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className={`hidden md:flex ${collapsed ? "justify-center px-2 py-5" : "absolute right-3 top-4 z-10"}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-xl font-medium text-slate-600 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-[#0a477e]"
            aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            title={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <div className={collapsed ? "md:hidden" : ""}>{sidebar}</div>
      </aside>

      <div className="min-w-0">
        <div data-erp-chrome className="print:hidden">{toolbar}</div>
        {children}
      </div>
    </div>
  );
}
