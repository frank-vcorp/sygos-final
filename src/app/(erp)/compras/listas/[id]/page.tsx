import { notFound, redirect } from "next/navigation";
import { convertShoppingListAction, removeShoppingListLineAction, setShoppingListSupplierAction, updateShoppingListLineAction } from "../../actions";
import { Button, Card, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { SupplierPicker } from "@/components/supplier-picker";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ListaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const { id } = await params;
  const [list, suppliers, categories, accounts] = await Promise.all([
    prisma.shoppingList.findFirst({ where: { id, companyId: session.activeCompanyId }, include: { supplier: true, lines: { include: { requirement: true } }, purchase: true } }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!list) notFound();
  const open = list.status === "ABIERTA";
  return <><PageHeader back={{ href: "/compras/listas", label: "Listas de compras" }} title={list.folio} subtitle={open ? "Lista abierta: aún no representa un movimiento financiero." : "Lista convertida en compra."} action={!open && list.purchase ? <RecordLink href={`/compras/${list.purchase.id}`}>Ver compra</RecordLink> : null} />
    <Card className="mb-4 p-4"><p className="text-sm text-[var(--muted)]">Proveedor</p><p className="font-semibold">{list.supplier?.name ?? "Sin proveedor"}</p>
      {open ? <form action={setShoppingListSupplierAction} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="listId" value={list.id} /><select name="supplierId" defaultValue={list.supplierId ?? ""} className={controlClass}><option value="">Sin proveedor por ahora</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="submit" tone="ghost">Guardar proveedor</Button></form> : null}
    </Card>
    <Table><thead><tr><Th>Origen</Th><Th>Partida</Th><Th>Cantidad</Th>{open ? <Th>Acciones</Th> : null}</tr></thead><tbody>{list.lines.map((line) => <tr key={line.id}><Td>{line.requirement.sourceType ?? "Requerimiento"}</Td><Td>{open ? <form action={updateShoppingListLineAction} className="grid gap-2 sm:grid-cols-3"><input type="hidden" name="listId" value={list.id} /><input type="hidden" name="lineId" value={line.id} /><input name="partNumber" defaultValue={line.partNumber} className={controlClass} /><input name="description" defaultValue={line.description} className={controlClass} /><input name="quantity" type="number" min="1" defaultValue={line.quantity} className={controlClass} /><Button type="submit" tone="ghost">Guardar</Button></form> : <><strong>{line.partNumber}</strong><span className="block text-sm text-[var(--muted)]">{line.description}</span></>}</Td><Td>{open ? "—" : line.quantity}</Td>{open ? <Td><form action={removeShoppingListLineAction}><input type="hidden" name="listId" value={list.id} /><input type="hidden" name="lineId" value={line.id} /><Button type="submit" tone="ghost">Quitar</Button></form></Td> : null}</tr>)}</tbody></Table>
    {open ? <FormPanel action={convertShoppingListAction} className="mt-6"><input type="hidden" name="listId" value={list.id} /><FormSection title="Convertir en compra" description="Completa solo la información financiera que falta.">
      <div className="md:col-span-2"><SupplierPicker suppliers={suppliers} defaultSupplierId={list.supplierId ?? ""} required allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)} /></div>
      <Field label="Fecha de compra"><input name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={controlClass} /></Field><Field label="Monto"><MoneyInput name="amount" min="0.01" required /></Field>
      <Field label="Categoría de egreso"><select name="expenseCategory" required defaultValue="" className={controlClass}><option value="" disabled>Selecciona una categoría</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field>
      <Field label="Subcategoría"><select name="expenseSubcategory" defaultValue="" className={controlClass}><option value="">Sin subcategoría</option>{categories.flatMap((item) => item.subcategories.map((sub) => <option key={sub.id} value={sub.name}>{item.name} · {sub.name}</option>))}</select></Field>
      <Field label="Descripción general"><input name="concept" defaultValue="Compra de refacciones y componentes" className={controlClass} /></Field><Field label="Forma de pago"><select name="paymentType" defaultValue="CONTADO" className={controlClass}><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option></select></Field>
      <Field label="Banco / cuenta, si aplica"><select name="accountId" defaultValue="" className={controlClass}><option value="">No aplica</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    </FormSection><FormActions><Button type="submit">Convertir en compra</Button></FormActions></FormPanel> : null}
  </>;
}
