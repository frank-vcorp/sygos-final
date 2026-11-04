/**
 * Reinicio de folios y datos del ciclo de servicio en staging (DX, OS, COT, FAC, REM, SRV).
 *
 * Conserva: usuarios, empresas, clientes, proveedores, partes, stock, catálogo y filas de equipo
 * (se resetea custodia a SIN_CUSTODIA / holderCompanyId null para bandeja limpia).
 *
 * NO borra clientes ni equipos (a diferencia de scripts/purge-operational-data.mts).
 *
 * Facturación en staging: se eliminan TODOS los billingDocument y dependientes
 * (paymentApplication, collectionNote, payment, billingLine, receivable, payable)
 * para arrancar FAC limpio junto con cotizaciones de servicio.
 *
 * Uso local:
 *   npm run reset-service-folios -- --dry-run
 *   SYGOS_RESET_SERVICE_FOLIOS=1 npm run reset-service-folios -- --execute
 *
 * Coolify (shell en el contenedor de la app, con DATABASE_URL del servicio):
 *   npx tsx scripts/reset-service-folios.mts --dry-run
 *   SYGOS_RESET_SERVICE_FOLIOS=1 npx tsx scripts/reset-service-folios.mts --execute
 *
 * Si DATABASE_URL parece producción, se muestra advertencia; usar --i-know para ejecutar igual.
 *
 * Interfaz web (solo administrador real): /admin/mantenimiento
 * Documentación operativa: ver reset-folios-staging en el Agent Store del proyecto.
 */
import { PrismaClient } from "@prisma/client";
import {
  executeServiceFolioReset,
  looksLikeProductionDatabaseUrl,
  snapshotServiceFolioResetCounts,
} from "../src/lib/reset-service-folios.ts";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const run = process.argv.includes("--execute");
  const iKnow = process.argv.includes("--i-know");

  if (!dryRun && !run) {
    console.error("Indica --dry-run o --execute");
    process.exit(1);
  }

  if (run && process.env.SYGOS_RESET_SERVICE_FOLIOS !== "1") {
    console.error(
      "Para ejecutar: SYGOS_RESET_SERVICE_FOLIOS=1 tsx scripts/reset-service-folios.mts --execute",
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (looksLikeProductionDatabaseUrl(dbUrl)) {
    console.warn(
      "ADVERTENCIA: DATABASE_URL parece apuntar a producción. Revisa antes de continuar.",
    );
    if (run && !iKnow) {
      console.error("Ejecución abortada. Usa --i-know si estás seguro.");
      process.exit(1);
    }
  }

  const before = await snapshotServiceFolioResetCounts(prisma);
  console.log(JSON.stringify({ phase: dryRun ? "dry-run" : "execute", before }, null, 2));

  if (dryRun) return;

  await executeServiceFolioReset({
    allowProduction: iKnow,
    databaseUrl: dbUrl,
    client: prisma,
  });
  const after = await snapshotServiceFolioResetCounts(prisma);
  console.log(JSON.stringify({ phase: "done", after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
