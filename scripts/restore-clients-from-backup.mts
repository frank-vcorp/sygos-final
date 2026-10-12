/**
 * Restaura clientes (y sus contactos) desde un respaldo SQLite hacia la base actual.
 * No borra ni modifica registros existentes: solo inserta los que faltan (por id).
 *
 * Las empresas se emparejan por código y los vendedores por nombre de usuario, de modo que
 * también sirve para una base con IDs distintos (p. ej. la instancia de diseño).
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

  const [backupCompanies, currentCompanies, backupUsers, currentUsers] = await Promise.all([
    backup.company.findMany({ select: { id: true, code: true } }),
    current.company.findMany({ select: { id: true, code: true } }),
    backup.user.findMany({ select: { id: true, username: true } }),
    current.user.findMany({ select: { id: true, username: true } }),
  ]);
  const currentCompanyByCode = new Map(currentCompanies.map((row) => [row.code, row.id]));
  const companyMap = new Map<string, string>();
  for (const row of backupCompanies) {
    const target = currentCompanyByCode.get(row.code);
    if (target) companyMap.set(row.id, target);
  }
  const currentUserByName = new Map(currentUsers.map((row) => [row.username, row.id]));
  const userMap = new Map<string, string>();
  for (const row of backupUsers) {
    const target = currentUserByName.get(row.username);
    if (target) userMap.set(row.id, target);
  }

  const existingClientIds = new Set((await current.client.findMany({ select: { id: true } })).map((row) => row.id));
  const existingContactIds = new Set((await current.contact.findMany({ select: { id: true } })).map((row) => row.id));

  const withCompany = backupClients.filter((row) => companyMap.has(row.companyId));
  const skippedUnknownCompany = backupClients.length - withCompany.length;
  const missingClients = withCompany.filter((row) => !existingClientIds.has(row.id));
  const missingClientIds = new Set(missingClients.map((row) => row.id));
  const missingContacts = backupContacts.filter(
    (row) => !existingContactIds.has(row.id) && (missingClientIds.has(row.clientId) || existingClientIds.has(row.clientId)),
  );
  const ownerUnmapped = missingClients.filter((row) => row.ownerUserId && !userMap.has(row.ownerUserId)).length;

  console.log(
    JSON.stringify(
      {
        phase: execute ? "execute" : "dry-run",
        backupClients: backupClients.length,
        backupContacts: backupContacts.length,
        alreadyPresentClients: withCompany.length - missingClients.length,
        toInsertClients: missingClients.length,
        toInsertContacts: missingContacts.length,
        skippedUnknownCompany,
        ownerUserWithoutMatch: ownerUnmapped,
      },
      null,
      2,
    ),
  );
  if (!execute) return;

  const clientData = missingClients.map((row) => ({
    ...row,
    companyId: companyMap.get(row.companyId)!,
    ownerUserId: row.ownerUserId ? userMap.get(row.ownerUserId) ?? null : null,
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
