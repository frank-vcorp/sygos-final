import { redirect } from "next/navigation";
import { EquipmentDetail } from "@/components/equipment-detail";

const CUSTODIA_VISTAS = new Set(["pendientes", "resguardo", "fuera", "definitiva"]);

export default async function EquipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etiqueta?: string; vista?: string; documentoSalida?: string }>;
}) {
  const { id } = await params;
  const { etiqueta, vista, documentoSalida } = await searchParams;
  if (documentoSalida) {
    redirect(`/documentos/salida/${documentoSalida}`);
  }
  const fromCustodiaVista = vista && CUSTODIA_VISTAS.has(vista) ? vista : undefined;
  return (
    <EquipmentDetail
      id={id}
      expectedKind="EQUI"
      showLabel={etiqueta === "1"}
      fromCustodiaVista={fromCustodiaVista}
    />
  );
}
