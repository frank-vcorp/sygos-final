import { EquipmentDetail } from "@/components/equipment-detail";

export default async function MotorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etiqueta?: string }> }) {
  const { id } = await params;
  const { etiqueta } = await searchParams;
  return <EquipmentDetail id={id} expectedKind="MOT" showLabel={etiqueta === "1"} />;
}
