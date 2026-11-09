-- Reserva SRV al crear cotización comercial ligada a taller (COTDX/COTOS)

ALTER TABLE "Quote" ADD COLUMN "reservedServiceNumber" INTEGER;
