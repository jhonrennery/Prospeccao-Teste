import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import { DatabaseAuthStore } from "./baileys-auth-store.js";
import { env } from "./config.js";
import { createSupabaseClient } from "./supabase.js";

type SessionStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "reconnecting" | "error";

type Runtime = {
  userId: string;
  sessionId: string;
  accessToken: string;
  socket: any;
  authStore: DatabaseAuthStore;
  authState: Awaited<ReturnType<DatabaseAuthStore["load"]>>;
};

type SessionRow = {
  id: string;
  user_id: string;
  name: string;
  phone_number: string | null;
  device_jid: string | null;
  session_status: SessionStatus;
  qr_payload: string | null;
  qr_expires_at: string | null;
  last_connected_at: string | null;
  last_seen_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ChatRow = { id: string; chat_jid: string };
type ContactRow = { id: string; contact_jid: string };

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const runtimes = new Map<string, Runtime>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const manualDisconnects = new Set<string>();

function runtimeKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

function coerceTimestamp(value: unknown) {
  if (value == null) return new Date().toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  if (typeof value === "object" && value && "low" in value) {
    return new Date(Number((value as { low: number }).low || 0) * 1000).toISOString();
  }
  return new Date().toISOString();
}

function parseMessageContent(message: WAMessage["message"] | undefined) {
  if (!message) return { type: "unknown", text: null as string | null, mediaCaption: null as string | null };
  if ("conversation" in message && typeof message.conversation === "string") return { type: "text", text: message.conversation, mediaCaption: null };
  if (message.extendedTextMessage?.text) return { type: "extended_text", text: message.extendedTextMessage.text, mediaCaption: null };
  if (message.imageMessage) return { type: "image", text: message.imageMessage.caption || null, mediaCaption: message.imageMessage.caption || null };
  if (message.videoMessage) return { type: "video", text: message.videoMessage.caption || null, mediaCaption: message.videoMessage.caption || null };
  if (message.documentMessage) return { type: "document", text: message.documentMessage.caption || null, mediaCaption: message.documentMessage.caption || null };
  if (message.audioMessage) return { type: "audio", text: null, mediaCaption: null };
  if (message.reactionMessage) return { type: "reaction", text: message.reactionMessage.text || null, mediaCaption: null };
  return { type: Object.keys(message)[0] || "unknown", text: null, mediaCaption: null };
}

function mapAckStatus(status: unknown) {
  if (typeof status !== "number") return null;
  if (status <= 0) return "queued";
  if (status === 1) return "server_ack";
  if (status === 2) return "delivered";
  if (status === 3) return "read";
  return "sent";
}

async function updateSessionRow(supabase: SupabaseClient, userId: string, sessionId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("whatsapp_sessions")
    .update({ ...patch, last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

async function getSession(supabase: SupabaseClient, userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data as SessionRow;
}

async function upsertContact(supabase: SupabaseClient, userId: string, sessionId: string, contact: {
  jid: string;
  lid?: string | null;
  phoneNumber?: string | null;
  pushName?: string | null;
  fullName?: string | null;
  profileName?: string | null;
  isBusiness?: boolean;
  avatarUrl?: string | null;
}) {
  const { data, error } = await supabase
    .from("whatsapp_contacts")
    .upsert({
      user_id: userId,
      session_id: sessionId,
      contact_jid: contact.jid,
      lid: contact.lid || null,
      phone_number: contact.phoneNumber || null,
      push_name: contact.pushName || null,
      full_name: contact.fullName || null,
      profile_name: contact.profileName || null,
      is_business: contact.isBusiness || false,
      avatar_url: contact.avatarUrl || null,
    }, { onConflict: "session_id,contact_jid" })
    .select("id, contact_jid")
    .single();
  if (error) throw error;
  return data as ContactRow;
}

async function upsertChat(supabase: SupabaseClient, userId: string, sessionId: string, chat: {
  jid: string;
  subject?: string | null;
  isGroup?: boolean;
  isArchived?: boolean;
  unreadCount?: number;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("whatsapp_chats")
    .upsert({
      user_id: userId,
      session_id: sessionId,
      chat_jid: chat.jid,
      subject: chat.subject || null,
      is_group: chat.isGroup || false,
      is_archived: chat.isArchived || false,
      unread_count: chat.unreadCount || 0,
      last_message_at: chat.lastMessageAt || null,
      metadata: chat.metadata || {},
    }, { onConflict: "session_id,chat_jid" })
    .select("id, chat_jid")
    .single();
  if (error) throw error;
  return data as ChatRow;
}

async function upsertMessage(supabase: SupabaseClient, userId: string, sessionId: string, message: WAMessage, statusOverride?: string | null) {
  const remoteJid = message.key.remoteJid;
  if (!remoteJid || !message.key.id) return;

  const fromMe = Boolean(message.key.fromMe);
  const meta = parseMessageContent(message.message);
  const chat = await upsertChat(supabase, userId, sessionId, {
    jid: remoteJid,
    isGroup: remoteJid.endsWith("@g.us"),
    lastMessageAt: coerceTimestamp(message.messageTimestamp),
  });

  let contact: ContactRow | null = null;
  const contactJid = fromMe ? remoteJid : message.key.participant || remoteJid;
  if (contactJid) {
    contact = await upsertContact(supabase, userId, sessionId, {
      jid: contactJid,
      pushName: message.pushName || null,
    });
  }

  const { error } = await supabase.from("whatsapp_messages").upsert({
    user_id: userId,
    session_id: sessionId,
    chat_id: chat.id,
    contact_id: contact?.id || null,
    baileys_message_id: message.key.id,
    chat_jid: remoteJid,
    sender_jid: fromMe ? (message.participant || message.pushName || null) : (message.key.participant || message.key.remoteJid || null),
    recipient_jid: fromMe ? remoteJid : null,
    push_name: message.pushName || null,
    message_direction: fromMe ? "outbound" : "inbound",
    message_type: meta.type,
    message_status: statusOverride || (fromMe ? "sent" : "received"),
    text_content: meta.text,
    media_caption: meta.mediaCaption,
    quoted_message_id: message.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
    sent_at: coerceTimestamp(message.messageTimestamp),
    raw_payload: message as unknown as Record<string, unknown>,
  }, { onConflict: "session_id,baileys_message_id" });
  if (error) throw error;
}

async function handleContactsUpsert(supabase: SupabaseClient, userId: string, sessionId: string, contacts: Array<Record<string, any>>) {
  for (const contact of contacts) {
    if (!contact.id) continue;
    await upsertContact(supabase, userId, sessionId, {
      jid: contact.id,
      lid: contact.lid || null,
      phoneNumber: contact.phoneNumber || null,
      pushName: contact.notify || null,
      fullName: contact.name || null,
      profileName: contact.verifiedName || null,
      isBusiness: Boolean(contact.verifiedName),
    });
  }
}

async function handleChatsUpsert(supabase: SupabaseClient, userId: string, sessionId: string, chats: Array<Record<string, any>>) {
  for (const chat of chats) {
    if (!chat.id) continue;
    await upsertChat(supabase, userId, sessionId, {
      jid: chat.id,
      subject: chat.name || chat.subject || null,
      isGroup: chat.id.endsWith("@g.us"),
      isArchived: Boolean(chat.archive),
      unreadCount: Number(chat.unreadCount || 0),
      lastMessageAt: chat.conversationTimestamp ? coerceTimestamp(chat.conversationTimestamp) : null,
      metadata: chat,
    });
  }
}

async function handleMessagesUpsert(supabase: SupabaseClient, userId: string, sessionId: string, payload: { messages?: WAMessage[] }) {
  for (const message of payload.messages || []) {
    await upsertMessage(supabase, userId, sessionId, message);
  }
}

async function handleMessagesUpdate(supabase: SupabaseClient, userId: string, sessionId: string, updates: Array<Record<string, any>>) {
  for (const item of updates) {
    const messageId = item.key?.id;
    if (!messageId) continue;
    const nextStatus = mapAckStatus(item.update?.status);
    if (!nextStatus) continue;

    const patch: Record<string, unknown> = { message_status: nextStatus };
    if (nextStatus === "delivered") patch.delivered_at = new Date().toISOString();
    if (nextStatus === "read") patch.read_at = new Date().toISOString();

    const { error } = await supabase
      .from("whatsapp_messages")
      .update(patch)
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .eq("baileys_message_id", messageId);
    if (error) throw error;
  }
}

function clearReconnectTimer(key: string) {
  const timer = reconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(key);
  }
}

async function scheduleReconnect(userId: string, sessionId: string, accessToken: string) {
  const key = runtimeKey(userId, sessionId);
  if (manualDisconnects.has(key) || reconnectTimers.has(key)) return;

  reconnectTimers.set(key, setTimeout(() => {
    reconnectTimers.delete(key);
    connectSession(userId, sessionId, accessToken).catch((error) => {
      logger.error({ error, sessionId }, "Falha ao reconectar sessao do WhatsApp");
    });
  }, 3000));
}

export async function connectSession(userId: string, sessionId: string, accessToken: string) {
  const key = runtimeKey(userId, sessionId);
  const existing = runtimes.get(key);
  if (existing) {
    existing.accessToken = accessToken;
    return existing;
  }

  const supabase = createSupabaseClient(accessToken);
  const session = await getSession(supabase, userId, sessionId);
  const authStore = new DatabaseAuthStore(supabase, userId, sessionId);
  const authState = await authStore.load();
  const { version } = await fetchLatestBaileysVersion();
  const sessionLogger = logger.child({ sessionId, userId });

  await updateSessionRow(supabase, userId, sessionId, { session_status: "connecting", error_message: null });

  const socket = makeWASocket({
    version,
    logger: sessionLogger,
    browser: Browsers.ubuntu(env.browserName),
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, sessionLogger),
    },
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async (): Promise<proto.IMessage | undefined> => undefined,
  });

  const runtime: Runtime = { userId, sessionId, accessToken, socket, authStore, authState };
  runtimes.set(key, runtime);
  clearReconnectTimer(key);

  socket.ev.on("creds.update", async (update: Record<string, unknown>) => {
    Object.assign(authState.creds, update);
    await authStore.saveCreds(authState.creds);
  });

  socket.ev.on("connection.update", async (update: Record<string, any>) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      await updateSessionRow(supabase, userId, sessionId, {
        session_status: "qr_ready",
        qr_payload: qr,
        qr_expires_at: new Date(Date.now() + 60_000).toISOString(),
        error_message: null,
      });
    }

    if (connection === "open") {
      await updateSessionRow(supabase, userId, sessionId, {
        session_status: "connected",
        phone_number: socket.user?.id?.split(":")[0] || session.phone_number,
        device_jid: socket.user?.id || null,
        qr_payload: null,
        qr_expires_at: null,
        last_connected_at: new Date().toISOString(),
        error_message: null,
      });
    }

    if (connection === "close") {
      runtimes.delete(key);
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

      if (manualDisconnects.has(key)) {
        manualDisconnects.delete(key);
        await updateSessionRow(supabase, userId, sessionId, {
          session_status: "disconnected",
          error_message: null,
          qr_payload: null,
          qr_expires_at: null,
        });
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        await authStore.clear();
        await updateSessionRow(supabase, userId, sessionId, {
          session_status: "disconnected",
          error_message: "Sessao desconectada do WhatsApp. Gere um novo QR Code.",
          qr_payload: null,
          qr_expires_at: null,
        });
        return;
      }

      await updateSessionRow(supabase, userId, sessionId, {
        session_status: "reconnecting",
        error_message: lastDisconnect?.error?.message || "Conexao perdida. Tentando reconectar.",
      });
      await scheduleReconnect(userId, sessionId, accessToken);
    }
  });

  socket.ev.on("messages.upsert", async (payload: { messages?: WAMessage[] }) => {
    await handleMessagesUpsert(supabase, userId, sessionId, payload);
  });

  socket.ev.on("messages.update", async (updates: Array<Record<string, any>>) => {
    await handleMessagesUpdate(supabase, userId, sessionId, updates);
  });

  socket.ev.on("chats.upsert", async (chats: Array<Record<string, any>>) => {
    await handleChatsUpsert(supabase, userId, sessionId, chats);
  });

  socket.ev.on("contacts.upsert", async (contacts: Array<Record<string, any>>) => {
    await handleContactsUpsert(supabase, userId, sessionId, contacts);
  });

  return runtime;
}

export async function ensureSession(userId: string, accessToken: string, name = "Sessao principal") {
  const supabase = createSupabaseClient(accessToken);
  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) return existing[0] as SessionRow;

  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .insert({ user_id: userId, name, session_status: "disconnected" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SessionRow;
}

export async function getSessions(userId: string, accessToken: string) {
  const supabase = createSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return Promise.all((data as SessionRow[]).map(async (session) => ({
    ...session,
    qr_data_url: session.qr_payload ? await QRCode.toDataURL(session.qr_payload, { margin: 1, width: 280 }) : null,
  })));
}

export async function disconnectSession(userId: string, sessionId: string, accessToken: string) {
  const key = runtimeKey(userId, sessionId);
  const runtime = runtimes.get(key);
  manualDisconnects.add(key);
  clearReconnectTimer(key);

  if (runtime?.socket?.end) runtime.socket.end(new Error("Manual disconnect"));
  else if (runtime?.socket?.ws?.close) runtime.socket.ws.close();

  runtimes.delete(key);
  const supabase = createSupabaseClient(accessToken);
  await updateSessionRow(supabase, userId, sessionId, {
    session_status: "disconnected",
    qr_payload: null,
    qr_expires_at: null,
    error_message: null,
  });
}

export async function listChats(userId: string, sessionId: string, accessToken: string) {
  const supabase = createSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("whatsapp_chats")
    .select("id, chat_jid, subject, is_group, unread_count, last_message_at, metadata, updated_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listMessages(userId: string, sessionId: string, chatJid: string, accessToken: string) {
  const supabase = createSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, baileys_message_id, chat_jid, sender_jid, recipient_jid, push_name, message_direction, message_type, message_status, text_content, media_caption, sent_at, delivered_at, read_at, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("chat_jid", chatJid)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return data;
}

export async function sendTextMessage(userId: string, sessionId: string, chatJid: string, text: string, accessToken: string) {
  const key = runtimeKey(userId, sessionId);
  let runtime = runtimes.get(key);
  if (!runtime) runtime = await connectSession(userId, sessionId, accessToken);

  const message = await runtime.socket.sendMessage(chatJid, { text });
  const supabase = createSupabaseClient(accessToken);
  await upsertMessage(supabase, userId, sessionId, message, "sent");
  return message;
}
