import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth-actions";
import { SygosLogo } from "@/components/brand-logo";
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <SygosLogo />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Operación de SYSTRON y Servomotores. Elige la empresa después de entrar si tu rol trabaja en ambas.</p>
      <form action={loginAction} className="mt-6 space-y-4 rounded-lg border border-[var(--line)] bg-white p-5">
        {flash ? <FlashBanner flash={flash} /> : null}
        <Field label="Usuario">
          <input name="username" required autoComplete="username" className={controlClass} />
        </Field>
        <Field label="Contraseña">
          <input name="password" required type="password" autoComplete="current-password" className={controlClass} />
        </Field>
        <SubmitButton className="w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
      </form>
    </main>
  );
}
