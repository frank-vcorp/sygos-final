import { EquipmentDetail } from "@/components/equipment-detail";

export default async function EquipoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etiqueta?: string }> }) {
  const { id } = await params;
  const { etiqueta } = await searchParams;
  return <EquipmentDetail id={id} expectedKind="EQUI" showLabel={etiqueta === "1"} />;
}
