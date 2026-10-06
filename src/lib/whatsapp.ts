import { mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { inSandbox, productionDatabasePath } from "./db";

export type WhatsAppState = {
  state: "desconectado" | "esperando" | "vinculado" | "error";
  qr: string | null;
  detail: string;
};

let current: WhatsAppState = { state: "desconectado", qr: null, detail: "Sin vincular. Baileys no pide una contraseña: el teléfono se enlaza con el QR." };
let socket: { logout?: () => Promise<void>; end?: (error?: Error) => void; ev: { on: (event: string, handler: (...args: never[]) => void) => void } } | null = null;
let starting: Promise<void> | null = null;

function authDir() {
  return join(dirname(productionDatabasePath()), "wa-auth");
}

export function whatsAppStatus() {
  return current;
}

async function connect(fresh: boolean) {
  if (await inSandbox()) throw new Error("En modo de pruebas no se vincula WhatsApp.");
  if (fresh) {
    if (socket?.logout) await socket.logout().catch(() => undefined);
    socket?.end?.();
    socket = null;
    rmSync(authDir(), { recursive: true, force: true });
  }
  mkdirSync(authDir(), { recursive: true });
  const baileys = await import("@whiskeysockets/baileys");
  const qrcode = await import("qrcode") as { toDataURL: (value: string) => Promise<string> };
  const makeSocket = baileys.default;
  const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir());
  const sock = makeSocket({ auth: state }) as unknown as NonNullable<typeof socket>;
  socket = sock;
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update: { connection?: string; qr?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } } }) => {
    if (update.qr) {
      void qrcode.toDataURL(update.qr).then((url: string) => {
        current = { state: "esperando", qr: url, detail: "En el teléfono: Ajustes, Dispositivos vinculados, Vincular un dispositivo." };
      });
    }
    if (update.connection === "open") current = { state: "vinculado", qr: null, detail: "WhatsApp vinculado. La sesión queda en el servidor." };
    if (update.connection === "close") {
      const loggedOut = update.lastDisconnect?.error?.output?.statusCode === 401;
      current = loggedOut
        ? { state: "desconectado", qr: null, detail: "La sesión se cerró desde el teléfono. Hay que volver a vincular." }
        : { state: "error", qr: null, detail: "Se cortó la conexión. Puedes reconectar sin un QR nuevo si la sesión sigue guardada." };
      socket = null;
    }
  });
}

export async function linkWhatsApp(fresh = false) {
  if (starting) return current;
  starting = connect(fresh).finally(() => {
    starting = null;
  });
  await starting;
  if (current.state === "desconectado") current = { ...current, state: "esperando", detail: "Esperando el código QR de Baileys." };
  return current;
}

export async function reconnectWhatsApp() {
  if (current.state === "desconectado") return linkWhatsApp(true);
  return linkWhatsApp(false);
}

export async function unlinkWhatsApp() {
  if (socket?.logout) await socket.logout().catch(() => undefined);
  socket?.end?.();
  socket = null;
  rmSync(authDir(), { recursive: true, force: true });
  current = { state: "desconectado", qr: null, detail: "Sesión borrada. Para usarlo otra vez hay que escanear un QR nuevo." };
  return current;
}
