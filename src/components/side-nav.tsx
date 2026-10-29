"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { pickGlobalActiveNavHref } from "@/lib/side-nav-active";

function SectionIcon({ title }: { title: string }) {
  const key = title.toLowerCase();
  const baseProps = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-3.5 w-3.5 shrink-0 opacity-80",
    "aria-hidden": true as const,
  };
  if (key.includes("inicio")) {
    return (
      <svg {...baseProps}>
        <path d="M3.5 8.5 10 3l6.5 5.5v7a1 1 0 0 1-1 1h-3.5v-4.5h-4V16.5H4.5a1 1 0 0 1-1-1v-7Z" />
      </svg>
    );
  }
  if (key.includes("finanza") || key.includes("factur") || key.includes("cobranza")) {
    return (
      <svg {...baseProps}>
        <rect x="2.75" y="4.5" width="14.5" height="11" rx="2" />
        <path d="M2.75 8.25h14.5M6.5 12h2.5" />
      </svg>
    );
  }
  if (key.includes("comercial")) {
    return (
      <svg {...baseProps}>
        <path d="M3.5 14.5 8 10l3 3 5.5-6" />
        <path d="M12.5 7h4v4" />
      </svg>
    );
  }
  if (key.includes("servicio") || key.includes("taller") || key.includes("operaci")) {
    return (
      <svg {...baseProps}>
        <path d="M11.5 5.5a3.5 3.5 0 0 0 4.2 4.2l-6.8 6.8a1.8 1.8 0 0 1-2.5-2.5l6.8-6.8a3.5 3.5 0 0 0-1.7-1.7Z" />
      </svg>
    );
  }
  if (key.includes("compra") || key.includes("almac")) {
    return (
      <svg {...baseProps}>
        <path d="M10 2.75 16.5 6v8L10 17.25 3.5 14V6L10 2.75Z" />
        <path d="M3.5 6 10 9.25 16.5 6M10 9.25v8" />
      </svg>
    );
  }
  if (key.includes("personal") || key.includes("nómina") || key.includes("nomina")) {
    return (
      <svg {...baseProps}>
        <circle cx="10" cy="6.75" r="2.75" />
        <path d="M4.5 16.25c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5" />
      </svg>
    );
  }
  if (key.includes("reporte")) {
    return (
      <svg {...baseProps}>
        <path d="M4 15.5V9.5M10 15.5V4.5M16 15.5v-8" />
      </svg>
    );
  }
  return (
    <svg {...baseProps}>
      <rect x="3.5" y="3.5" width="5.25" height="5.25" rx="1.2" />
      <rect x="11.25" y="3.5" width="5.25" height="5.25" rx="1.2" />
      <rect x="3.5" y="11.25" width="5.25" height="5.25" rx="1.2" />
      <rect x="11.25" y="11.25" width="5.25" height="5.25" rx="1.2" />
    </svg>
  );
}

const activeItemClass =
  "relative bg-white text-[#0a477e] font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/90 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[#0a477e]";
const inactiveItemClass = "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900";
const quickCreatePillClass =
  "mr-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-base font-semibold leading-none text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-[#0a477e]";

export function SideNav({
  groups,
  /** Si es false, las secciones del menú no usan acordeón (p. ej. rol Ventas). */
  accordionGroups = true,
}: {
  groups: Array<{
    title: string | null;
    direct?: boolean;
    links: Array<{ href: string; label: string; createHref?: string }>;
  }>;
  accordionGroups?: boolean;
}) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ?? new URLSearchParams();
  const [locationHash, setLocationHash] = useState("");
  useEffect(() => {
    const sync = () => setLocationHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [path]);
  const allHrefs = groups.flatMap((group) => group.links.map((link) => link.href));
  const globalActiveHref = pickGlobalActiveNavHref(path, search, allHrefs, locationHash);
  return (
    <nav className="space-y-1.5 px-3 pb-6" aria-label="Secciones">
      {groups.map((group) => {
        if (group.direct && group.title && group.links.length === 1) {
          const link = group.links[0]!;
          const active = link.href === globalActiveHref;
          return (
            <div
              key={link.href}
              className={`flex min-h-9 items-center rounded-lg transition-all ${active ? activeItemClass : inactiveItemClass}`}
            >
              <Link
                href={link.href}
                className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${active ? "text-[#0a477e]" : "text-slate-600"}`}
              >
                <SectionIcon title={group.title} />
                <span className="truncate">{group.title}</span>
              </Link>
              {link.createHref ? (
                <Link
                  href={link.createHref}
                  aria-label={`Alta rápida de ${group.title}`}
                  title={`Alta rápida de ${group.title}`}
                  className={quickCreatePillClass}
                >
                  +
                </Link>
              ) : null}
            </div>
          );
        }
        const groupActive = group.links.some((link) => link.href === globalActiveHref);
        const links = group.links.map((link) => {
            const active = link.href === globalActiveHref;
            return (
              <div key={link.href} className={`flex min-h-9 items-center rounded-lg transition-all ${active ? activeItemClass : inactiveItemClass}`}>
                <Link href={link.href} className={`block min-w-0 flex-1 px-3 py-2 text-[13.5px] ${active ? "font-semibold text-[#0a477e]" : "font-medium"}`} aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
                {link.createHref ? (
                  <Link href={link.createHref} aria-label={`Alta rápida de ${link.label}`} title={`Alta rápida de ${link.label}`} className={quickCreatePillClass}>
                    +
                  </Link>
                ) : null}
              </div>
            );
          });
        if (!group.title) return <div key={`plain-${group.links.map((link) => link.href).join("-")}`} className="space-y-1">{links}</div>;
        if (!accordionGroups) {
          return (
            <div key={group.title} className="pt-1">
              <div
                className={`flex min-h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${groupActive ? "text-[#0a477e]" : "text-slate-500"}`}
              >
                <SectionIcon title={group.title} />
                <span className="truncate">{group.title}</span>
              </div>
              <div className="mt-1 ml-3 space-y-1 border-l border-slate-200/90 pb-2 pl-2">{links}</div>
            </div>
          );
        }
        return (
          <details key={`${group.title}-${path}`} open={groupActive} className="group rounded-lg">
            <summary className={`flex min-h-9 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${groupActive ? "text-[#0a477e] hover:bg-slate-200/40" : "text-slate-500 hover:bg-slate-200/40 hover:text-slate-800"}`}>
              <span className="flex min-w-0 items-center gap-2">
                <SectionIcon title={group.title} />
                <span className="truncate">{group.title}</span>
              </span>
              <span className="text-base text-slate-400 transition-transform duration-200 group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <div className="mt-1 ml-3 space-y-1 border-l border-slate-200/90 pb-2 pl-2">{links}</div>
          </details>
        );
      })}
    </nav>
  );
}
