import { prismaProd } from "./db";
import { money, roundMoney } from "./money";

export const ADMIN_BALANCE_ADJUSTMENT_CATEGORY = "Ajuste administrador";

export type BalanceAdjustmentPlan = {
  current: number;
  target: number;
  delta: number;
  direction: "INGRESO" | "EGRESO";
  amount: number;
};

export function computeBalanceAdjustment(currentBalance: number, targetBalance: number): BalanceAdjustmentPlan | null {
  if (!Number.isFinite(currentBalance) || !Number.isFinite(targetBalance)) {
    throw new Error("El saldo no es válido.");
  }
  const current = roundMoney(currentBalance);
  const target = roundMoney(targetBalance);
  const delta = roundMoney(target - current);
  if (delta === 0) return null;
  return {
    current,
    target,
    delta,
    direction: delta > 0 ? "INGRESO" : "EGRESO",
    amount: Math.abs(delta),
  };
}

export function adminAdjustmentNote(motivo: string, current: number, target: number) {
  return `${motivo.trim()} · Saldo ${money(current)} → ${money(target)}`;
}

export async function applyAdminBalanceAdjustment(companyId: string, accountId: string, targetBalance: number, motivo: string) {
  const motivoTrim = motivo.trim();
  if (!motivoTrim) throw new Error("El motivo es obligatorio.");
  if (!Number.isFinite(targetBalance)) throw new Error("El nuevo saldo no es válido.");

  const account = await prismaProd.financeAccount.findFirst({ where: { id: accountId, companyId, active: true } });
  if (!account) throw new Error("Selecciona una cuenta activa de esta empresa.");

  const plan = computeBalanceAdjustment(account.balance, targetBalance);
  if (!plan) throw new Error("El nuevo saldo coincide con el saldo actual.");

  const note = adminAdjustmentNote(motivoTrim, plan.current, plan.target);

  return prismaProd.$transaction(async (tx) => {
    await tx.financeAccount.update({ where: { id: account.id }, data: { balance: plan.target } });
    const movement = await tx.financeMovement.create({
      data: {
        companyId,
        accountId: account.id,
        direction: plan.direction,
        amount: plan.amount,
        category: ADMIN_BALANCE_ADJUSTMENT_CATEGORY,
        originType: "AJUSTE_ADMIN",
        originId: account.id,
        note,
      },
    });
    return { account, movement, plan };
  });
}
