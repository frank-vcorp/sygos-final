import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth-actions";
import { FlashBanner } from "@/components/flash-banner";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field } from "@/components/ui";
import { takeFlash } from "@/lib/flash";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    const { homePath } = await import("@/lib/home");
    redirect(session.activeCompanyId ? homePath(session.role, session.activeCompanyCode) : "/empresa");
  }
  const flash = await takeFlash();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-12 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a477e] text-white shadow-md ring-1 ring-[#0a477e]/20">
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M10 2.5 16.5 6.25v7.5L10 17.5 3.5 13.75v-7.5L10 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M10 6.5 13.5 8.5v3L10 13.5 6.5 11.5v-3L10 6.5Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[#0a477e]">SYGOS 3.0</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Operación de SYSTRON y Servomotores. Elige la empresa después de entrar si tu rol trabaja en ambas.
          </p>
        </div>

        <form
          action={loginAction}
          data-form-panel=""
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="space-y-4 p-6">
            {flash ? <FlashBanner flash={flash} /> : null}
            <Field label="Usuario">
              <input name="username" required autoComplete="username" placeholder="Ej. direccion" className={controlClass} />
            </Field>
            <Field label="Contraseña">
              <input name="password" required type="password" autoComplete="current-password" placeholder="••••••••" className={controlClass} />
            </Field>
          </div>
          <div className="border-t border-slate-200/80 bg-slate-50/80 px-6 py-3.5">
            <SubmitButton className="w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
          </div>
        </form>

        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] font-medium text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0284c7]" aria-hidden />
            SYSTRON
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Servomotores
          </span>
        </div>
      </div>
    </main>
  );
}
