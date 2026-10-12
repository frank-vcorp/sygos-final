/**
 * Restaura clientes (y sus contactos) desde un respaldo SQLite hacia la base actual.
 * No borra ni modifica registros existentes: solo inserta los que faltan (por id).
 *
 * Uso:
 *   BACKUP_DB=/data/sygos.db.bak-... tsx scripts/restore-clients-from-backup.mts --dry-run
 *   BACKUP_DB=/data/sygos.db.bak-... tsx scripts/restore-clients-from-backup.mts --execute
 */
import { PrismaClient } from "@prisma/client";

const backupPath = process.env.BACKUP_DB;
if (!backupPath) {
  console.error("Define BACKUP_DB con la ruta del respaldo.");
  process.exit(1);
}

const current = new PrismaClient();
const backup = new PrismaClient({ datasourceUrl: `file:${backupPath}` });

async function main() {
  const execute = process.argv.includes("--execute");
  if (!execute && !process.argv.includes("--dry-run")) {
    console.error("Indica --dry-run o --execute");
    process.exit(1);
  }

  const backupClients = await backup.client.findMany({ where: { isSystem: false } });
  const backupContacts = await backup.contact.findMany({ where: { client: { isSystem: false } } });

  const existingClientIds = new Set((await current.client.findMany({ select: { id: true } })).map((row) => row.id));
  const existingContactIds = new Set((await current.contact.findMany({ select: { id: true } })).map((row) => row.id));
  const companyIds = new Set((await current.company.findMany({ select: { id: true } })).map((row) => row.id));
  const userIds = new Set((await current.user.findMany({ select: { id: true } })).map((row) => row.id));

  const missingClients = backupClients.filter((row) => !existingClientIds.has(row.id) && companyIds.has(row.companyId));
  const orphanedByCompany = backupClients.filter((row) => !companyIds.has(row.companyId)).length;
  const missingClientIds = new Set(missingClients.map((row) => row.id));
  const missingContacts = backupContacts.filter((row) => !existingContactIds.has(row.id) && (missingClientIds.has(row.clientId) || existingClientIds.has(row.clientId)));

  const ownerMissing = missingClients.filter((row) => row.ownerUserId && !userIds.has(row.ownerUserId)).length;

  const summary = {
    backupClients: backupClients.length,
    backupContacts: backupContacts.length,
    alreadyPresentClients: backupClients.length - missingClients.length - orphanedByCompany,
    toInsertClients: missingClients.length,
    toInsertContacts: missingContacts.length,
    skippedUnknownCompany: orphanedByCompany,
    ownerUserNoLongerExists: ownerMissing,
  };
  console.log(JSON.stringify({ phase: execute ? "execute" : "dry-run", ...summary }, null, 2));
  if (!execute) return;

  const clientData = missingClients.map((row) => ({
    ...row,
    ownerUserId: row.ownerUserId && userIds.has(row.ownerUserId) ? row.ownerUserId : null,
  }));
  const batch = 200;
  for (let i = 0; i < clientData.length; i += batch) {
    await current.client.createMany({ data: clientData.slice(i, i + batch) });
  }
  for (let i = 0; i < missingContacts.length; i += batch) {
    await current.contact.createMany({ data: missingContacts.slice(i, i + batch) });
  }

  console.log(
    JSON.stringify(
      {
        phase: "done",
        clientsNow: await current.client.count(),
        clientsNonSystem: await current.client.count({ where: { isSystem: false } }),
        contactsNow: await current.contact.count(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await current.$disconnect();
    await backup.$disconnect();
  });
