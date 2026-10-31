import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { WHATSAPP_UNLINKED_MESSAGE } from "./collaborator-credentials";
import { inSandbox, prismaProd, productionDatabasePath } from "./db";

export type WhatsAppState = {
  state: "desconectado" | "esperando" | "vinculado" | "error";
  statusLabel: "Desconectado" | "Esperando escaneo QR" | "QR listo para escanear" | "Conectado" | "Error de conexión";
  qr: string | null;
  detail: string;
  linkedPhone: string | null;
  linkedName: string | null;
  enabled: boolean;
  defaultCountryCode: string;
  hasSavedSession: boolean;
  updatedAt: string;
};

export type WhatsAppExtraConfig = {
  enabled: boolean;
  defaultCountryCode: string;
  linkedPhone?: string | null;
  linkedName?: string | null;
  lastConnectedAt?: string | null;
};

type BaileysSocketLike = {
  user?: { id?: string; name?: string; verifiedName?: string; notify?: string };
  logout?: () => Promise<void>;
  end?: (error?: Error) => void;
  sendMessage?: (jid: string, content: { text: string }) => Promise<unknown>;
  onWhatsApp?: (...jids: string[]) => Promise<Array<{ jid: string; exists: boolean }> | undefined>;
  ev: { on: (event: string, handler: (...args: never[]) => void) => void };
};

type WhatsAppRuntime = {
  current: WhatsAppState;
  socket: BaileysSocketLike | null;
  starting: Promise<void> | null;
};

const globalForWhatsApp = globalThis as unknown as {
  __sygosWhatsApp?: WhatsAppRuntime;
};

function authDir() {
  return join(dirname(productionDatabasePath()), "wa-auth");
}

function hasSavedAuthFiles(): boolean {
  try {
    const dir = authDir();
    if (!existsSync(dir)) return false;
    return readdirSync(dir).some((f) => f === "creds.json");
  } catch {
    return false;
  }
}

function createInitialState(): WhatsAppState {
  const saved = hasSavedAuthFiles();
  return {
    state: "desconectado",
    statusLabel: "Desconectado",
    qr: null,
    detail: saved
      ? "Sesión guardada en servidor. Haz clic en Reconectar o Generar QR para activar la conexión."
      : "Sin vincular. Haz clic en «Iniciar vinculación / Generar QR» y escanea el código desde WhatsApp > Dispositivos vinculados.",
    linkedPhone: null,
    linkedName: null,
    enabled: true,
    defaultCountryCode: "52",
    hasSavedSession: saved,
    updatedAt: new Date().toISOString(),
  };
}

function runtime(): WhatsAppRuntime {
  if (!globalForWhatsApp.__sygosWhatsApp) {
    globalForWhatsApp.__sygosWhatsApp = {
      current: createInitialState(),
      socket: null,
      starting: null,
    };
  }
  return globalForWhatsApp.__sygosWhatsApp;
}

export function extractPhoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const userPart = jid.split("@")[0] ?? "";
  const phoneDigits = (userPart.split(":")[0] ?? "").replace(/\D/g, "");
  return phoneDigits ? `+${phoneDigits}` : null;
}

export function formatWhatsAppPhone(
  phone: string | null | undefined,
  defaultCountryCode = "52",
): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const cc = defaultCountryCode.replace(/\D/g, "") || "52";
  if (digits.length === 10) return `${cc}${digits}`;
  return digits;
}

export function buildWhatsAppFallbackUrl(
  phone: string | null | undefined,
  text: string,
  defaultCountryCode = "52",
): string {
  const digits = formatWhatsAppPhone(phone, defaultCountryCode);
  const encoded = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function parseWhatsAppExtra(raw: string | null | undefined): WhatsAppExtraConfig {
  if (!raw) {
    return { enabled: true, defaultCountryCode: "52", linkedPhone: null, linkedName: null, lastConnectedAt: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WhatsAppExtraConfig>;
    return {
      enabled: parsed.enabled !== false,
      defaultCountryCode: (parsed.defaultCountryCode ?? "52").replace(/\D/g, "") || "52",
      linkedPhone: parsed.linkedPhone ?? null,
      linkedName: parsed.linkedName ?? null,
      lastConnectedAt: parsed.lastConnectedAt ?? null,
    };
  } catch {
    return { enabled: true, defaultCountryCode: "52", linkedPhone: null, linkedName: null, lastConnectedAt: null };
  }
}

async function persistWhatsAppMeta(patch: Partial<WhatsAppExtraConfig>, companyId?: string | null) {
  try {
    const existing = await prismaProd.integrationSetting.findFirst({
      where: { provider: "WHATSAPP", companyId: companyId ?? null },
    });
    const currentExtra = parseWhatsAppExtra(existing?.extra);
    const nextExtra: WhatsAppExtraConfig = {
      ...currentExtra,
      ...patch,
    };
    const extraJson = JSON.stringify(nextExtra);
    if (existing) {
      await prismaProd.integrationSetting.update({
        where: { id: existing.id },
        data: { extra: extraJson, secretHint: nextExtra.linkedPhone ?? existing.secretHint },
      });
    } else {
      await prismaProd.integrationSetting.create({
        data: {
          provider: "WHATSAPP",
          companyId: companyId ?? null,
          secretHint: nextExtra.linkedPhone ?? null,
          extra: extraJson,
        },
      });
    }
  } catch {
    // Non-fatal metadata persistence
  }
}

export async function saveWhatsAppSettings(
  input: { enabled: boolean; defaultCountryCode: string },
  companyId?: string | null,
): Promise<WhatsAppState> {
  const cleanCc = input.defaultCountryCode.replace(/\D/g, "") || "52";
  const rt = runtime();
  rt.current = {
    ...rt.current,
    enabled: input.enabled,
    defaultCountryCode: cleanCc,
    updatedAt: new Date().toISOString(),
  };
  await persistWhatsAppMeta({ enabled: input.enabled, defaultCountryCode: cleanCc }, companyId);
  await persistWhatsAppMeta({ enabled: input.enabled, defaultCountryCode: cleanCc }, null);
  return whatsAppStatus();
}

export function whatsAppStatus(): WhatsAppState {
  const rt = runtime();
  rt.current.hasSavedSession = hasSavedAuthFiles();
  return rt.current;
}

export async function getWhatsAppFullStatus(companyId?: string | null): Promise<WhatsAppState> {
  const rt = runtime();
  try {
    const rows = await prismaProd.integrationSetting.findMany({
      where: {
        provider: "WHATSAPP",
        ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    const row = (companyId ? rows.find((r) => r.companyId === companyId) : undefined) ?? rows.find((r) => r.companyId === null) ?? rows[0];
    if (row) {
      const extra = parseWhatsAppExtra(row.extra);
      rt.current.enabled = extra.enabled;
      rt.current.defaultCountryCode = extra.defaultCountryCode;
      if (rt.current.state === "vinculado") {
        rt.current.linkedPhone = rt.current.linkedPhone ?? extra.linkedPhone ?? null;
        rt.current.linkedName = rt.current.linkedName ?? extra.linkedName ?? null;
      }
    }
  } catch {
    // Ignore DB lookup errors
  }
  rt.current.hasSavedSession = hasSavedAuthFiles();
  return rt.current;
}

async function connect(fresh: boolean) {
  if (await inSandbox()) throw new Error("En modo de pruebas no se vincula WhatsApp.");
  const rt = runtime();

  if (fresh) {
    if (rt.socket?.logout) await rt.socket.logout().catch(() => undefined);
    rt.socket?.end?.();
    rt.socket = null;
    rmSync(authDir(), { recursive: true, force: true });
    rt.current = {
      ...rt.current,
      state: "esperando",
      statusLabel: "Esperando escaneo QR",
      qr: null,
      linkedPhone: null,
      linkedName: null,
      detail: "Generando código QR de vinculación con WhatsApp…",
      hasSavedSession: false,
      updatedAt: new Date().toISOString(),
    };
  }

  mkdirSync(authDir(), { recursive: true });
  const baileys = await import("@whiskeysockets/baileys");
  const qrcode = (await import("qrcode")) as { toDataURL: (value: string, opts?: unknown) => Promise<string> };
  const makeSocket = baileys.default ?? baileys.makeWASocket;
  const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir());

  if (rt.socket && !fresh) {
    rt.socket.end?.();
    rt.socket = null;
  }

  const silentLogger = {
    level: "silent",
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    fatal: () => undefined,
    child: () => silentLogger,
  };

  const sock = makeSocket({
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger as never,
    browser: ["SYGOS 3.0 ERP", "Chrome", "1.0.0"],
  }) as unknown as BaileysSocketLike;

  rt.socket = sock;

  const meFromCreds = (state.creds as { me?: { id?: string; name?: string } } | undefined)?.me;
  if (meFromCreds?.id) {
    rt.current.linkedPhone = extractPhoneFromJid(meFromCreds.id);
    rt.current.linkedName = meFromCreds.name ?? rt.current.linkedName;
  }

  sock.ev.on("creds.update", saveCreds as never);
  sock.ev.on(
    "connection.update",
    (update: {
      connection?: string;
      qr?: string;
      lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } };
    }) => {
      if (update.qr) {
        void qrcode
          .toDataURL(update.qr, { margin: 2, width: 280 })
          .then((url: string) => {
            rt.current = {
              ...rt.current,
              state: "esperando",
              statusLabel: "QR listo para escanear",
              qr: url,
              detail:
                "Abre WhatsApp en tu teléfono → Configuración / Menú → Dispositivos vinculados → Vincular un dispositivo y escanea este código QR.",
              hasSavedSession: hasSavedAuthFiles(),
              updatedAt: new Date().toISOString(),
            };
          });
      }

      if (update.connection === "open") {
        const me = (sock.user ?? (state.creds as { me?: { id?: string; name?: string } } | undefined)?.me) as
          | { id?: string; name?: string; verifiedName?: string; notify?: string }
          | undefined;
        const linkedPhone = extractPhoneFromJid(me?.id) ?? rt.current.linkedPhone;
        const linkedName = me?.name ?? me?.verifiedName ?? me?.notify ?? rt.current.linkedName ?? "Cuenta vinculada";
        rt.current = {
          ...rt.current,
          state: "vinculado",
          statusLabel: "Conectado",
          qr: null,
          linkedPhone,
          linkedName,
          detail: linkedPhone
            ? `WhatsApp conectado (${linkedPhone}${linkedName ? ` · ${linkedName}` : ""}). La sesión está activa en el servidor.`
            : "WhatsApp conectado. La sesión está activa en el servidor.",
          hasSavedSession: true,
          updatedAt: new Date().toISOString(),
        };
        void persistWhatsAppMeta({
          linkedPhone,
          linkedName,
          lastConnectedAt: new Date().toISOString(),
        });
      }

      if (update.connection === "close") {
        const statusCode = update.lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === 401;
        const restartRequired = statusCode === 515;

        if (restartRequired) {
          rt.socket = null;
          void connect(false).catch(() => undefined);
          return;
        }

        if (loggedOut) {
          rt.socket = null;
          rmSync(authDir(), { recursive: true, force: true });
          rt.current = {
            ...rt.current,
            state: "desconectado",
            statusLabel: "Desconectado",
            qr: null,
            linkedPhone: null,
            linkedName: null,
            hasSavedSession: false,
            detail: "La sesión se cerró desde el teléfono. Haz clic en «Iniciar vinculación / Generar QR» para vincular de nuevo.",
            updatedAt: new Date().toISOString(),
          };
          void persistWhatsAppMeta({ linkedPhone: null, linkedName: null });
          return;
        }

        rt.socket = null;
        rt.current = {
          ...rt.current,
          state: "error",
          statusLabel: "Error de conexión",
          qr: null,
          hasSavedSession: hasSavedAuthFiles(),
          detail:
            "Se interrumpió la conexión con WhatsApp. Puedes hacer clic en «Reconectar» si la sesión sigue guardada o generar un QR nuevo.",
          updatedAt: new Date().toISOString(),
        };
      }
    },
  );
}

async function waitForQrOrOpen(timeoutMs = 3500): Promise<void> {
  const rt = runtime();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (rt.current.qr || rt.current.state === "vinculado") return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function linkWhatsApp(fresh = false): Promise<WhatsAppState> {
  const rt = runtime();
  if (rt.starting) {
    await rt.starting;
    return whatsAppStatus();
  }
  rt.starting = connect(fresh).finally(() => {
    rt.starting = null;
  });
  await rt.starting;
  if (rt.current.state === "desconectado") {
    rt.current = {
      ...rt.current,
      state: "esperando",
      statusLabel: "Esperando escaneo QR",
      detail: "Generando el código QR de Baileys…",
      updatedAt: new Date().toISOString(),
    };
  }
  await waitForQrOrOpen(3000);
  return whatsAppStatus();
}

export async function reconnectWhatsApp(): Promise<WhatsAppState> {
  const rt = runtime();
  if (rt.current.state === "desconectado" && !hasSavedAuthFiles()) {
    return linkWhatsApp(true);
  }
  return linkWhatsApp(false);
}

export async function unlinkWhatsApp(): Promise<WhatsAppState> {
  const rt = runtime();
  if (rt.socket?.logout) await rt.socket.logout().catch(() => undefined);
  rt.socket?.end?.();
  rt.socket = null;
  rmSync(authDir(), { recursive: true, force: true });
  rt.current = {
    ...rt.current,
    state: "desconectado",
    statusLabel: "Desconectado",
    qr: null,
    linkedPhone: null,
    linkedName: null,
    hasSavedSession: false,
    detail: "Sesión desvinculada y eliminada. Para usar WhatsApp nuevamente, genera y escanea un código QR nuevo.",
    updatedAt: new Date().toISOString(),
  };
  await persistWhatsAppMeta({ linkedPhone: null, linkedName: null });
  return whatsAppStatus();
}

export type SendWhatsAppMessageInput = {
  companyId?: string | null;
  phone: string;
  text: string;
};

export type SendWhatsAppMessageResult = {
  ok: boolean;
  sentViaBaileys: boolean;
  message: string;
  messageId: string | null;
  /** Conservado por compatibilidad. No es la vía de entrega: el envío es solo Baileys. */
  fallbackUrl: string | null;
  jid?: string;
};

export function whatsAppMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const key = (payload as { key?: { id?: unknown } }).key;
  if (!key || typeof key.id !== "string") return null;
  const id = key.id.trim();
  return id || null;
}

function failedSend(
  message: string,
): SendWhatsAppMessageResult {
  return {
    ok: false,
    sentViaBaileys: false,
    message,
    messageId: null,
    fallbackUrl: null,
  };
}

/**
 * Envía un mensaje de WhatsApp por la sesión Baileys ya vinculada.
 * Si no hay sesión, el alta u otra operación que llame esto debe continuar
 * y mostrar `WhatsApp no está vinculado`. No abre wa.me.
 */
export async function sendWhatsAppMessage(
  input: SendWhatsAppMessageInput,
): Promise<SendWhatsAppMessageResult> {
  const status = await getWhatsAppFullStatus(input.companyId);
  const digits = formatWhatsAppPhone(input.phone, status.defaultCountryCode);
  const text = input.text.trim();

  if (!digits || digits.length < 10) {
    return failedSend("El número de teléfono de WhatsApp debe tener al menos 10 dígitos.");
  }

  if (!text) {
    return failedSend("El mensaje de WhatsApp no puede estar vacío.");
  }

  if (await inSandbox()) {
    return failedSend("PRUEBA / SIN VALIDEZ. En modo de pruebas no se envían mensajes de WhatsApp.");
  }

  if (!status.enabled) {
    return failedSend("La integración de WhatsApp (Baileys) está deshabilitada en Configuración.");
  }

  const rt = runtime();
  if (rt.current.state !== "vinculado" || !rt.socket?.sendMessage) {
    return failedSend(WHATSAPP_UNLINKED_MESSAGE);
  }

  try {
    let targetJid = `${digits}@s.whatsapp.net`;
    if (typeof rt.socket.onWhatsApp === "function") {
      try {
        const lookup = await rt.socket.onWhatsApp(targetJid);
        if (lookup && lookup[0]?.exists && lookup[0].jid) {
          targetJid = lookup[0].jid;
        }
      } catch {
        // Sigue con el JID armado a partir del teléfono.
      }
    }
    const sent = await rt.socket.sendMessage(targetJid, { text });
    const messageId = whatsAppMessageId(sent);
    return {
      ok: true,
      sentViaBaileys: true,
      message: messageId ? `Enviado por WhatsApp (${messageId}).` : "Enviado por WhatsApp.",
      messageId,
      fallbackUrl: null,
      jid: targetJid,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Error al enviar por Baileys.";
    return failedSend(`No se pudo enviar el WhatsApp vía Baileys: ${errMsg}`);
  }
}

/**
 * Envía el texto por la sesión Baileys vinculada.
 * Si no está vinculada, `sentViaBaileys` es false y `message` es
 * "WhatsApp no está vinculado." La interfaz copia el texto; no abre wa.me.
 */
export async function sendWhatsAppTextIfLinked(
  phoneDigits: string,
  text: string,
  companyId?: string | null,
): Promise<SendWhatsAppMessageResult> {
  return sendWhatsAppMessage({
    companyId,
    phone: phoneDigits,
    text,
  });
}
