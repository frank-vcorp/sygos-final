"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function ErpShell({
  sidebar,
  toolbar,
  children,
  sidebarCollapsible = true,
}: {
  sidebar: React.ReactNode;
  toolbar: React.ReactNode;
  children: React.ReactNode;
  /** Cuando es false el menú lateral permanece expandido (p. ej. rol Ventas). */
  sidebarCollapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!sidebarCollapsible) {
      setCollapsed(false);
      return;
    }
    setCollapsed(window.localStorage.getItem("sygos_sidebar_collapsed") === "si");
  }, [sidebarCollapsible]);
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
    if (!sidebarCollapsible) return;
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sygos_sidebar_collapsed", next ? "si" : "no");
      return next;
    });
  }

  const sidebarCollapsed = sidebarCollapsible && collapsed;

  return (
    <div
      data-erp-shell
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      className={`min-h-screen md:grid ${sidebarCollapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[280px_minmax(0,1fr)]"}`}
    >
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
        <span className="text-sm font-semibold tracking-tight text-[var(--accent)]">SYGOS</span>
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
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] overflow-y-auto border-r border-[#d7e1ec] bg-[#f8fbfd] transition-[transform,width] md:sticky md:top-0 md:z-20 md:h-screen md:w-auto md:translate-x-0 ${
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
        {sidebarCollapsible ? (
          <div className={`hidden md:flex ${sidebarCollapsed ? "justify-center px-2 py-5" : "absolute right-3 top-3 z-10"}`}>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#d7e1ec] bg-white text-2xl font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              aria-label={sidebarCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
              title={sidebarCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>
        ) : null}
        <div className={sidebarCollapsed ? "md:hidden" : ""}>{sidebar}</div>
      </aside>

      <div className="min-w-0">
        <div data-erp-chrome className="print:hidden">{toolbar}</div>
        {children}
      </div>
    </div>
  );
}
