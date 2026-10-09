import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth-actions";
import { SygosLogo } from "@/components/brand-logo";
import { FlashBanner } from "@/components/flash-banner";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";
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
      <FormPanel action={loginAction} className="mt-6 max-w-none">
        <FormSection title="Acceso" columns={1}>
          {flash ? <FlashBanner flash={flash} /> : null}
          <Field label="Usuario">
            <input name="username" required autoComplete="username" className={controlClass} />
          </Field>
          <Field label="Contraseña">
            <input name="password" required type="password" autoComplete="current-password" className={controlClass} />
          </Field>
        </FormSection>
        <FormActions>
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Entrando…">Entrar</SubmitButton>
        </FormActions>
      </FormPanel>
    </main>
  );
}
