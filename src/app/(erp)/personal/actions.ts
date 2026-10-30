"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { optionalMoneyFromForm } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import {
  addLaborDocument,
  adjustVacationBalance,
  changeBoss,
  changeSalary,
  deactivateCollaborator,
  decideAttendanceJustification,
  decideCompensation,
  decideLeavePermission,
  decideVacation,
  enrollFingerprint,
  manualAttendance,
  registerAttendanceIncidence,
  registerCollaborator,
  registerManualEntry,
  registerManualExit,
  requestCompensation,
  requestLeavePermission,
  requestOvertime,
  requestOvertimeByHours,
  requestVacation,
  reviewOvertime,
  toggleCollaboratorActiveStatus,
  updateActivitiesSection,
  updateAttendanceMode,
  updateBonusesSection,
  updateCommissionSection,
  updateFiscalDataSection,
  updateLaborDataSection,
  updatePersonalDataSection,
  updateSchedule,
  type CollaboratorActivity,
  type CommissionTier,
} from "@/lib/personnel";
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

function backUrl(formData: FormData, collaboratorId: string, defaultTab = "datos") {
  const custom = optionalText(formData.get("returnTo"));
  if (custom && custom.startsWith("/personal")) return custom;
  const tab = optionalText(formData.get("tab")) ?? defaultTab;
  const subtab = optionalText(formData.get("subtab"));
  const params = new URLSearchParams();
  if (tab && tab !== "datos") params.set("tab", tab);
  if (subtab) params.set("subtab", subtab);
  const qs = params.toString();
  return `/personal/colaboradores/${collaboratorId}${qs ? `?${qs}` : ""}`;
}

export async function hireAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("personnel.authorize");
    const row = await registerCollaborator(session, {
      userId: requiredText(formData.get("userId"), "Usuario"),
      hireKind: formData.get("hireKind") === "MIGRADO" ? "MIGRADO" : "NUEVO",
      hiredAt: requiredText(formData.get("hiredAt"), "Fecha de ingreso"),
      bossUserId: optionalText(formData.get("bossUserId")),
      dailyStamped: optionalMoneyFromForm(formData.get("dailyStamped")) ?? 0,
      dailyCash: optionalMoneyFromForm(formData.get("dailyCash")) ?? 0,
      vacationBalance: Number(formData.get("vacationBalance") || 0),
      rfc: optionalText(formData.get("rfc")),
      overtimeRate: optionalMoneyFromForm(formData.get("overtimeRate")) ?? 0,
      jobTitle: optionalText(formData.get("jobTitle")),
      workSchedule: optionalText(formData.get("workSchedule")),
      birthDate: optionalText(formData.get("birthDate")),
      phone: optionalText(formData.get("phone")),
      email: optionalText(formData.get("email")),
      address: optionalText(formData.get("address")),
      emergencyContact: optionalText(formData.get("emergencyContact")),
      curp: optionalText(formData.get("curp")),
      nss: optionalText(formData.get("nss")),
    });
    await setFlash({ tone: "ok", message: "Colaborador registrado." });
    redirect(`/personal/colaboradores/${row.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/personal");
  }
}

export async function toggleCollaboratorStatusAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const enable = formData.get("enable") === "1";
    await toggleCollaboratorActiveStatus(session, id, parseVersion(formData.get("version")), enable);
    await setFlash({
      tone: "ok",
      message: enable ? "Colaborador habilitado nuevamente." : "Colaborador deshabilitado. Se conserva todo su historial.",
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function personalDataSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await updatePersonalDataSection(session, id, parseVersion(formData.get("version")), {
      name: requiredText(formData.get("name"), "Nombre"),
      birthDate: optionalText(formData.get("birthDate")),
      phone: optionalText(formData.get("phone")),
      email: optionalText(formData.get("email")),
      address: optionalText(formData.get("address")),
      emergencyContact: optionalText(formData.get("emergencyContact")),
    });
    await setFlash({ tone: "ok", message: "Datos personales actualizados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function laborDataSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await updateLaborDataSection(session, id, parseVersion(formData.get("version")), {
      jobTitle: optionalText(formData.get("jobTitle")),
      bossUserId: optionalText(formData.get("bossUserId")),
      hiredAt: requiredText(formData.get("hiredAt"), "Fecha de ingreso"),
      workSchedule: requiredText(formData.get("workSchedule"), "Horario / jornada"),
    });
    await setFlash({ tone: "ok", message: "Datos laborales actualizados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function fiscalDataSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await updateFiscalDataSection(session, id, parseVersion(formData.get("version")), {
      rfc: optionalText(formData.get("rfc")),
      curp: optionalText(formData.get("curp")),
      nss: optionalText(formData.get("nss")),
    });
    await setFlash({ tone: "ok", message: "Datos fiscales y de seguridad social actualizados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function commissionSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const enabled = formData.get("commissionEnabled") === "1";
    const targets = formData.getAll("tierTargetAmount");
    const kinds = formData.getAll("tierKind");
    const values = formData.getAll("tierValue");
    const tiers: CommissionTier[] = [];
    for (let i = 0; i < targets.length; i++) {
      const rawTarget = String(targets[i] ?? "").trim();
      const rawValue = String(values[i] ?? "").trim();
      if (rawTarget === "" && rawValue === "") continue;
      tiers.push({
        targetAmount: Number(rawTarget.replace(/,/g, "")) || 0,
        kind: String(kinds[i] ?? "PORCENTAJE") === "MONTO" ? "MONTO" : "PORCENTAJE",
        value: Number(rawValue.replace(/,/g, "")) || 0,
      });
    }
    await updateCommissionSection(session, id, parseVersion(formData.get("version")), enabled, tiers);
    await setFlash({ tone: "ok", message: "Comisión por facturación actualizada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function activitiesSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const enabled = formData.get("activitiesEnabled") === "1";
    const names = formData.getAll("activityName");
    const counts = formData.getAll("activityTarget");
    const activities: CollaboratorActivity[] = [];
    for (let i = 0; i < names.length; i++) {
      const name = String(names[i] ?? "").trim();
      if (!name) continue;
      activities.push({
        name,
        targetCount: Number(counts[i] ?? 0) || 0,
      });
    }
    await updateActivitiesSection(session, id, parseVersion(formData.get("version")), enabled, activities);
    await setFlash({ tone: "ok", message: "Actividades comerciales actualizadas." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
}

export async function bonusesSectionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await updateBonusesSection(session, id, parseVersion(formData.get("version")), {
      bonusesEnabled: formData.get("bonusesEnabled") === "1",
      punctualityBonusEnabled: formData.get("punctualityBonusEnabled") === "1",
      punctualityBonus: optionalMoneyFromForm(formData.get("punctualityBonus")) ?? 0,
      productivityBonusEnabled: formData.get("productivityBonusEnabled") === "1",
      productivityBonus: optionalMoneyFromForm(formData.get("productivityBonus")) ?? 0,
    });
    await setFlash({ tone: "ok", message: "Bonos actualizados." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
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
  redirect(backUrl(formData, id));
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
  redirect(backUrl(formData, id));
}

export async function salaryAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const singleSalary = optionalMoneyFromForm(formData.get("sueldoVigente"));
    const dailyStamped =
      singleSalary != null
        ? singleSalary
        : (optionalMoneyFromForm(formData.get("dailyStamped")) ?? 0);
    const dailyCash =
      singleSalary != null
        ? (optionalMoneyFromForm(formData.get("dailyCash")) ?? 0)
        : (optionalMoneyFromForm(formData.get("dailyCash")) ?? 0);
    const overtimeRate = optionalMoneyFromForm(formData.get("overtimeRate")) ?? 0;
    await changeSalary(session, id, parseVersion(formData.get("version")), dailyStamped, dailyCash, overtimeRate);
    await setFlash({ tone: "ok", message: "Sueldo vigente actualizado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id));
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
  redirect(backUrl(formData, id));
}

export async function attendanceModeAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    const mode = formData.get("attendanceMode") === "MANUAL" ? "MANUAL" : "AUTOMATICA";
    await updateAttendanceMode(session, id, parseVersion(formData.get("version")), mode);
    await setFlash({ tone: "ok", message: `Modo cambiado a asistencia ${mode === "MANUAL" ? "manual" : "automática"}.` });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "asistencia"));
}

export async function manualEntryAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await registerManualEntry(
      session,
      id,
      requiredText(formData.get("workDate"), "Fecha"),
      requiredText(formData.get("entryTime"), "Hora de entrada"),
    );
    await setFlash({ tone: "ok", message: "Entrada registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "asistencia"));
}

export async function manualExitAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await registerManualExit(
      session,
      id,
      requiredText(formData.get("workDate"), "Fecha"),
      requiredText(formData.get("exitTime"), "Hora de salida"),
    );
    await setFlash({ tone: "ok", message: "Salida registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "asistencia"));
}

export async function attendanceIncidenceAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    const kind = formData.get("kind") === "RETARDO" ? "RETARDO" : "AUSENCIA";
    const asksJustification = formData.get("justified") === "si";
    await registerAttendanceIncidence(
      session,
      id,
      requiredText(formData.get("workDate"), "Fecha"),
      kind,
      requiredText(formData.get("reason"), "Motivo"),
      asksJustification,
    );
    await setFlash({
      tone: "ok",
      message: asksJustification
        ? `${kind === "RETARDO" ? "Retardo" : "Falta"} registrada y enviada a validación del CEO.`
        : `${kind === "RETARDO" ? "Retardo registrado como no justificado" : "Falta registrada como no justificada"}.`,
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "asistencia"));
}

export async function attendanceJustificationDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const approved = formData.get("decision") === "si";
    await decideAttendanceJustification(
      session,
      requiredText(formData.get("attendanceId"), "Registro de asistencia"),
      parseVersion(formData.get("version")),
      approved,
    );
    await setFlash({
      tone: "ok",
      message: approved ? "Incidencia validada como justificada." : "Incidencia marcada como no justificada.",
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "asistencia"));
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
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function vacationRequestAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await requireCompany();
    await requestVacation(
      session,
      id,
      requiredText(formData.get("startDate"), "Fecha inicial"),
      requiredText(formData.get("endDate"), "Fecha final"),
      optionalText(formData.get("comment")),
    );
    await setFlash({ tone: "ok", message: "Solicitud de vacaciones registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function vacationDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("vacationId"), "Vacación");
  const back = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    await decideVacation(session, id, parseVersion(formData.get("version")), formData.get("decision") === "si");
    await setFlash({ tone: "ok", message: "Decisión de vacaciones registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, back, "solicitudes"));
}

export async function collaboratorOvertimeRequestAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await requestOvertimeByHours(
      session,
      id,
      requiredText(formData.get("workDate"), "Fecha"),
      Number(formData.get("hours") || 0),
      requiredText(formData.get("reason"), "Motivo"),
    );
    await setFlash({ tone: "ok", message: "Solicitud de horas extra registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function collaboratorOvertimeDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const approved = formData.get("decision") === "si";
    const rawAuthHours = optionalText(formData.get("authorizedHours"));
    const authHours = rawAuthHours != null ? Number(rawAuthHours) : undefined;
    await reviewOvertime(
      session,
      requiredText(formData.get("overtimeId"), "Solicitud"),
      parseVersion(formData.get("version")),
      approved,
      authHours,
    );
    await setFlash({ tone: "ok", message: approved ? "Horas extra autorizadas." : "Horas extra rechazadas." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function compensationRequestAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await requestCompensation(
      session,
      id,
      requiredText(formData.get("concept"), "Concepto / motivo"),
      optionalMoneyFromForm(formData.get("requestedAmount")) ?? 0,
      optionalText(formData.get("comment")),
    );
    await setFlash({ tone: "ok", message: "Solicitud de compensación registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function compensationDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const approved = formData.get("decision") === "si";
    const authorizedAmount = optionalMoneyFromForm(formData.get("authorizedAmount")) ?? undefined;
    await decideCompensation(
      session,
      requiredText(formData.get("compensationId"), "Compensación"),
      parseVersion(formData.get("version")),
      approved,
      authorizedAmount,
    );
    await setFlash({ tone: "ok", message: approved ? "Compensación autorizada." : "Compensación rechazada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function leavePermissionRequestAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    await requestLeavePermission(
      session,
      id,
      requiredText(formData.get("startDate"), "Fecha inicial"),
      optionalText(formData.get("endDate")),
      requiredText(formData.get("reason"), "Motivo"),
      optionalText(formData.get("comment")),
    );
    await setFlash({ tone: "ok", message: "Solicitud de permiso registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
}

export async function leavePermissionDecisionAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.authorize");
    const approved = formData.get("decision") === "si";
    await decideLeavePermission(
      session,
      requiredText(formData.get("permissionId"), "Permiso"),
      parseVersion(formData.get("version")),
      approved,
    );
    await setFlash({
      tone: "ok",
      message: approved
        ? "Permiso autorizado y ausencia reconocida como justificada en Asistencia."
        : "Permiso rechazado.",
    });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "solicitudes"));
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
  redirect(backUrl(formData, id));
}

export async function documentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("collaboratorId"), "Colaborador");
  try {
    const session = await guard("personnel.manage");
    const title = requiredText(formData.get("title"), "Nombre del documento");
    const note = optionalText(formData.get("note")) ?? "";
    const occurredOn = optionalText(formData.get("occurredOn"));
    const fileEntry = formData.get("file");
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileDataUrl: string | null = null;

    if (fileEntry && typeof fileEntry === "object" && "arrayBuffer" in fileEntry && fileEntry.size > 0) {
      if (fileEntry.size > 5 * 1024 * 1024) {
        throw new Error("El archivo no debe superar 5 MB.");
      }
      fileName = fileEntry.name || `${title}.bin`;
      mimeType = fileEntry.type || "application/octet-stream";
      const buf = Buffer.from(await fileEntry.arrayBuffer());
      fileDataUrl = `data:${mimeType};base64,${buf.toString("base64")}`;
    }

    await addLaborDocument(
      session,
      id,
      formData.get("kind") === "ACTA" ? "ACTA" : "GENERAL",
      title,
      note,
      occurredOn,
      { fileName, mimeType, fileDataUrl },
    );
    await setFlash({ tone: "ok", message: "Documento subido." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(backUrl(formData, id, "documentos"));
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
