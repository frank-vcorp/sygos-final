import {
  activeTechnicalCaseFolio,
  type ServicioBandejaDisplayColumnKey,
} from "@/lib/servicios-bandeja";
import type { SupervisorServicioRow } from "@/lib/servicios-supervisor-rows";

export function bandejaColumnSortValue(
  row: SupervisorServicioRow,
  key: ServicioBandejaDisplayColumnKey,
  historial: boolean,
): unknown {
  if (row.kind === "cancelado") {
    switch (key) {
      case "atencionVigente":
        return row.createdAt;
      case "equipo":
        return row.equipmentLabel;
      case "cliente":
        return row.clientName;
      case "sla":
        return row.closedAt ?? row.createdAt;
      default:
        return "";
    }
  }

  switch (key) {
    case "atencionVigente":
      return row.attentionCreatedAt;
    case "servicioActivo": {
      const active = activeTechnicalCaseFolio(row);
      return active?.folio ?? "";
    }
    case "diagnostico":
      return row.diagnosisFolio ?? "";
    case "ordenServicio":
      return row.osFolio ?? "";
    case "equipo":
      return row.equipmentLabel;
    case "cliente":
      return row.clientName;
    case "edoTecnico":
      return row.technical.label;
    case "edoAdministrativo":
      return row.administrative.label;
    case "vendedor":
      return row.sellerName ?? "";
    case "tecnico":
      return row.technicianName ?? "";
    case "sla":
      return historial ? row.closedAt ?? row.createdAt : row.slaDueAt ?? row.slaStartedAt ?? row.createdAt;
    case "cotizacion":
      return row.quoteFolio ?? "";
    case "cotizacionMonto":
      return row.quoteMonto;
    default:
      return "";
  }
}