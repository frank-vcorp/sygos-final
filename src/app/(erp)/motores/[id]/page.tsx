import { EquipmentDetail } from "@/components/equipment-detail";

const CUSTODIA_VISTAS = new Set(["pendientes", "resguardo", "fuera", "definitiva"]);

export default async function MotorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etiqueta?: string; vista?: string }>;
}) {
  const { id } = await params;
  const { etiqueta, vista } = await searchParams;
  const fromCustodiaVista = vista && CUSTODIA_VISTAS.has(vista) ? vista : undefined;
  return (
    <EquipmentDetail
      id={id}
      expectedKind="MOT"
      showLabel={etiqueta === "1"}
      fromCustodiaVista={fromCustodiaVista}
    />
  );
}
