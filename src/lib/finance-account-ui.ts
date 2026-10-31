export type FinanceAccountDeleteUsage = {
  movements: number;
  purchases: number;
  transferTargets: number;
  cardPayments: number;
};

export function financeAccountDeleteBlockedMessage(
  label: string,
  usage: FinanceAccountDeleteUsage,
  balance: number,
): string | null {
  const where: string[] = [];
  if (usage.movements > 0) where.push("movimientos financieros");
  if (usage.purchases > 0) where.push("compras");
  if (usage.transferTargets > 0) where.push("transferencias");
  if (usage.cardPayments > 0) where.push("pagos con tarjeta");
  if (balance !== 0 && where.length === 0) where.push("saldo registrado");
  if (where.length === 0) return null;
  const places = where.length === 1
    ? where[0]
    : where.length === 2
      ? `${where[0]} y ${where[1]}`
      : `${where.slice(0, -1).join(", ")} y ${where.at(-1)}`;
  return `No se puede eliminar la cuenta «${label}»: está en uso en ${places}.`;
}

export function financeAccountDeleteConfirm(label: string) {
  return `¿Eliminar la cuenta «${label}»? Esta acción no se puede deshacer.`;
}
