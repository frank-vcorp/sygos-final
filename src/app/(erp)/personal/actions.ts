"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { addLaborDocument, adjustVacationBalance, changeBoss, changeSalary, deactivateCollaborator, decideVacation, enrollFingerprint, manualAttendance, registerCollaborator, requestOvertime, requestVacation, reviewOvertime, updateSchedule } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/db";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
  return session;
}

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function hireAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const row = await registerCollaborator(session, {
      userId: requiredText(formData.get("userId"), "Usuario"),
      hireKind: formData.get("hireKind") === "MIGRADO" ? "MIGRADO" : "NUEVO",
      hiredAt: requiredText(formData.get("hiredAt"), "Fecha de ingreso"),
      bossUserId: optionalText(formData.get("bossUserId")),
      dailyStamped: Number(formData.get("dailyStamped") || 0),
      dailyCash: Number(formData.get("dailyCash") || 0),
      vacationBalance: Number(formData.get("vacationBalance") || 0),
      rfc: optionalText(formData.get("rfc")),
      overtimeRate: Number(formData.get("overtimeRate") || 0),
    });
    await setFlash({ tone: "ok", message: "Colaborador registrado." });
    redirect(`/personal/${row.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/personal/nuevo");
  }
}

export async function laborIdAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await prisma.collaborator.updateMany({
      where: { id, companyId: session.activeCompanyId },
      data: { rfc: optionalText(formData.get("rfc")), curp: optionalText(formData.get("curp")), nss: optionalText(formData.get("nss")), fiscalZip: optionalText(formData.get("fiscalZip")) },
    });
    await setFlash({ tone: "ok", message: "Datos fiscales del colaborador guardados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function bossAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await changeBoss(session, id, parseVersion(formData.get("version")), requiredText(formData.get("bossUserId"), "Jefe"));
    await setFlash({ tone: "ok", message: "Jefe actualizado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function salaryAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await changeSalary(session, id, parseVersion(formData.get("version")), Number(formData.get("dailyStamped") || 0), Number(formData.get("dailyCash") || 0), Number(formData.get("overtimeRate") || 0));
    await setFlash({ tone: "ok", message: "Salario actualizado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function bajaAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await deactivateCollaborator(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Baja registrada. El acceso quedó deshabilitado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function vacationBalanceAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await adjustVacationBalance(session, id, parseVersion(formData.get("version")), Number(formData.get("balance")), requiredText(formData.get("reason"), "Motivo"));
    await setFlash({ tone: "ok", message: "Saldo de vacaciones ajustado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function vacationRequestAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await requireCompany();
    await requestVacation(session, id, requiredText(formData.get("startDate"), "Inicio"), requiredText(formData.get("endDate"), "Fin"));
    await setFlash({ tone: "ok", message: "Solicitud de vacaciones registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function vacationDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("vacationId"), "Vacación");
  const back = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await decideVacation(session, id, parseVersion(formData.get("version")), formData.get("decision") === "si");
    await setFlash({ tone: "ok", message: "Decisión registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${back}`);
}

export async function attendanceAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.manage");
    const status = String(formData.get("status") || "PERMISO");
    const allowed = status === "NORMAL" || status === "RETARDO" || status === "AUSENCIA" || status === "PERMISO" || status === "SALIDA_FALTANTE" ? status : "PERMISO";
    await manualAttendance(session, requiredText(formData.get("collaboratorId"), "Colaborador"), requiredText(formData.get("workDate"), "Fecha"), allowed, requiredText(formData.get("note"), "Motivo"), formData.get("justified") === "si", formData.get("paidLeave") === "si");
    await setFlash({ tone: "ok", message: "Asistencia registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/personal/asistencia");
}

export async function scheduleAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await updateSchedule(session, id, parseVersion(formData.get("version")), requiredText(formData.get("scheduleStart"), "Horario"), Number(formData.get("toleranceMinutes") || 0));
    await enrollFingerprint(session, id, optionalText(formData.get("fingerprintNote")) ?? "");
    await setFlash({ tone: "ok", message: "Horario actualizado. Los días ya marcados no se recalculan." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function documentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await addLaborDocument(session, id, formData.get("kind") === "ACTA" ? "ACTA" : "GENERAL", requiredText(formData.get("title"), "Título"), requiredText(formData.get("note"), "Descripción"), optionalText(formData.get("occurredOn")));
    await setFlash({ tone: "ok", message: "Documento registrado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/personal/${id}`);
}

export async function overtimeAction(formData: FormData) {
  "use server";
  try {
    const session = await requireCompany();
    if (!can(session.role, "overtime.capture", session.activeCompanyCode) && session.role !== "CEO" && session.role !== "ADMINISTRADOR") throw new Error("No tienes permiso para esta acción.");
    await requestOvertime(session, requiredText(formData.get("collaboratorId"), "Colaborador"), requiredText(formData.get("workDate"), "Fecha"), requiredText(formData.get("startedAt"), "Inicio"), requiredText(formData.get("endedAt"), "Fin"), requiredText(formData.get("reason"), "Motivo"));
    await setFlash({ tone: "ok", message: "Horas extra registradas. El tipo lo calcula la autorización." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/personal/horas");
}

export async function overtimeReviewAction(formData: FormData) {
  "use server";
  try {
    const session = await requireCompany();
    await reviewOvertime(session, requiredText(formData.get("overtimeId"), "Solicitud"), parseVersion(formData.get("version")), formData.get("decision") === "si");
    await setFlash({ tone: "ok", message: "Decisión registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/personal/horas");
}
