"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { pickGlobalActiveNavHref } from "@/lib/side-nav-active";

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
    <nav className="space-y-2 px-3 pb-6" aria-label="Secciones">
      {groups.map((group) => {
        if (group.direct && group.title && group.links.length === 1) {
          const link = group.links[0]!;
          const active = link.href === globalActiveHref;
          return (
            <div
              key={link.href}
              className={`flex min-h-10 items-center rounded-xl transition-colors ${active ? "bg-[var(--accent)] text-white shadow-[0_5px_14px_rgba(10,71,126,0.18)]" : "text-[var(--muted)] hover:bg-[#edf5f8]"}`}
            >
              <Link
                href={link.href}
                className={`block min-w-0 flex-1 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] ${active ? "text-white" : ""}`}
              >
                {group.title}
              </Link>
              {link.createHref ? (
                <Link
                  href={link.createHref}
                  aria-label={`Alta rápida de ${group.title}`}
                  title={`Alta rápida de ${group.title}`}
                  className={`mr-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg font-semibold leading-none ${active ? "text-white hover:bg-white/15" : "text-[var(--accent)] hover:bg-white"}`}
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
              <div key={link.href} className={`flex min-h-10 items-center rounded-xl transition-colors ${active ? "bg-[var(--accent)] text-white shadow-[0_5px_14px_rgba(10,71,126,0.18)]" : "text-[#263b55] hover:bg-[var(--accent-soft)]"}`}>
                <Link href={link.href} className="block min-w-0 flex-1 px-3 py-2.5 text-[14px] font-medium" aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
                {link.createHref ? (
                  <Link href={link.createHref} aria-label={`Alta rápida de ${link.label}`} title={`Alta rápida de ${link.label}`} className={`mr-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg font-semibold leading-none ${active ? "text-white hover:bg-white/15" : "text-[var(--accent)] hover:bg-white"}`}>
                    +
                  </Link>
                ) : null}
              </div>
            );
          });
        if (!group.title) return <div key={`plain-${group.links.map((link) => link.href).join("-")}`} className="space-y-1">{links}</div>;
        if (!accordionGroups) {
          return (
            <div key={group.title} className="rounded-lg">
              <div
                className={`flex min-h-10 items-center rounded-lg px-3 text-[12px] font-bold uppercase tracking-[0.08em] ${groupActive ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
              >
                {group.title}
              </div>
              <div className="space-y-1 pb-2 pl-1">{links}</div>
            </div>
          );
        }
        return (
          <details key={`${group.title}-${path}`} open={groupActive} className="group rounded-lg">
            <summary className={`flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-[12px] font-bold uppercase tracking-[0.08em] ${groupActive ? "text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[#edf5f8]"}`}>
              {group.title}
              <span className="text-base transition-transform group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <div className="space-y-1 pb-2 pl-1">{links}</div>
          </details>
        );
      })}
    </nav>
  );
}
