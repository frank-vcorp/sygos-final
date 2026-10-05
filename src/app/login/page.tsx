import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth-actions";
import { FlashBanner } from "@/components/flash-banner";
import { Button, controlClass, Field } from "@/components/ui";
import { takeFlash } from "@/lib/flash";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.activeCompanyId ? "/inicio" : "/empresa");
  const flash = await takeFlash();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm font-medium text-[var(--muted)]">SYGOS 3.0</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Operación de SYSTRON y Servomotores. Elige la empresa después de entrar si tu rol trabaja en ambas.</p>
      <form action={loginAction} className="mt-6 space-y-4 rounded-lg border border-[var(--line)] bg-white p-5">
        {flash ? <FlashBanner flash={flash} /> : null}
        <Field label="Usuario">
          <input name="username" autoComplete="username" className={controlClass} />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" autoComplete="current-password" className={controlClass} />
        </Field>
        <Button type="submit" className="w-full">Entrar</Button>
      </form>
    </main>
  );
}
