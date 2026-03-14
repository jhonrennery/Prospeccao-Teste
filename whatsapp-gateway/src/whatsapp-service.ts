import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import { DatabaseAuthStore } from "./baileys-auth-store.js";
import { env } from "./config.js";
import { supabaseAdmin } from "./supabase.js";

type SessionStatus = "disconnected" | "connecting" | "qr_ready" | "connected" | "reconnecting" | "error";
type Runtime = {
  userId: string;
  sessionId: string;
  socket: any;
  authStore: DatabaseAuthStore;
  authState: Awaited<ReturnType<DatabaseAuthStore["load"]>>;
  logger: pino.Logger;
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

type ChatRow = {
  id: string;
  chat_jid: string;
};

type ContactRow = {
  id: string;
  contact_jid: string;
};

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const runtimes = new Map<string, Runtime>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const manualDisconnects = new Set<string>();

function sessionRuntimeKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

function coerceTimestamp(value: unknown) {
  if (value == null) {
    return new Date().toISOString();
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "object" && value && "low" in value) {
    const low = Number((value as { low: number }).low || 0);
    return new Date(low * 1000).toISOString();
  }

  return new Date().toISOString();
}

function parseMessageContent(message: WAMessage["message"] | undefined) {
  if (!message) {
    return { type: "unknown", text: null as string | null, mediaCaption: null as string | null };
  }

  if ("conversation" in message && typeof message.conversation === "string") {
    return { type: "text", text: message.conversation, mediaCaption: null };
  }

  if (message.extendedTextMessage?.text) {
    return { type: "extended_text", text: message.extendedTextMessage.text, mediaCaption: null };
  }

  if (message.imageMessage) {
    return { type: "image", text: message.imageMessage.caption || null, mediaCaption: message.imageMessage.caption || null };
  }

  if (message.videoMessage) {
    return { type: "video", text: message.videoMessage.caption || null, mediaCaption: message.videoMessage.caption || null };
  }

  if (message.documentMessage) {
    return { type: "document", text: message.documentMessage.caption || null, mediaCaption: message.documentMessage.caption || null };
  }

  if (message.audioMessage) {
    return { type: "audio", text: null, mediaCaption: null };
  }

  if (message.reactionMessage) {
    return { type: "reaction", text: message.reactionMessage.text || null, mediaCaption: null };
  }

  const messageType = Object.keys(message)[0] || "unknown";
  return { type: messageType, text: null, mediaCaption: null };
}

function mapAckStatus(status: unknown): string | null {
  if (typeof status !== "number") {
    return null;
  }

  if (status <= 0) return "queued";
  if (status === 1) return "server_ack";
  if (status === 2) return "delivered";
  if (status === 3) return "read";
  return "sent";
}

async function updateSessionRow(userId: string, sessionId: string, patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .update({ ...patch, last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function getSession(userId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as SessionRow;
}

async function upsertContact(userId: string, sessionId: string, contact: {
  jid: string;
  lid?: string | null;
  phoneNumber?: string | null;
  pushName?: string | null;
  fullName?: string | null;
  profileName?: string | null;
  isBusiness?: boolean;
  avatarUrl?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_contacts")
    .upsert(
      {
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
      },
      { onConflict: "session_id,contact_jid" },
    )
    .select("id, contact_jid")
    .single();

  if (error) {
    throw error;
  }

  return data as ContactRow;
}

async function upsertChat(userId: string, sessionId: string, chat: {
  jid: string;
  subject?: string | null;
  isGroup?: boolean;
  isArchived?: boolean;
  unreadCount?: number;
  lastMessageAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_chats")
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        chat_jid: chat.jid,
        subject: chat.subject || null,
        is_group: chat.isGroup || false,
        is_archived: chat.isArchived || false,
        unread_count: chat.unreadCount || 0,
        last_message_at: chat.lastMessageAt || null,
        metadata: chat.metadata || {},
      },
      { onConflict: "session_id,chat_jid" },
    )
    .select("id, chat_jid")
    .single();

  if (error) {
    throw error;
  }

  return data as ChatRow;
}

async function upsertMessage(userId: string, sessionId: string, message: WAMessage, statusOverride?: string | null) {
  const remoteJid = message.key.remoteJid;
  if (!remoteJid || !message.key.id) {
    return;
  }

  const fromMe = Boolean(message.key.fromMe);
  const messageMeta = parseMessageContent(message.message);
  const senderJid = fromMe ? (message.participant || message.pushName || null) : (message.key.participant || message.key.remoteJid || null);
  const recipientJid = fromMe ? remoteJid : null;
  const chat = await upsertChat(userId, sessionId, {
    jid: remoteJid,
    isGroup: remoteJid.endsWith("@g.us"),
    lastMessageAt: coerceTimestamp(message.messageTimestamp),
  });

  let contact: ContactRow | null = null;
  const canonicalContactJid = fromMe ? remoteJid : message.key.participant || remoteJid;
  if (canonicalContactJid) {
    contact = await upsertContact(userId, sessionId, {
      jid: canonicalContactJid,
      pushName: message.pushName || null,
    });
  }

  const { error } = await supabaseAdmin.from("whatsapp_messages").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      chat_id: chat.id,
      contact_id: contact?.id || null,
      baileys_message_id: message.key.id,
      chat_jid: remoteJid,
      sender_jid: senderJid,
      recipient_jid: recipientJid,
      push_name: message.pushName || null,
      message_direction: fromMe ? "outbound" : "inbound",
      message_type: messageMeta.type,
      message_status: statusOverride || (fromMe ? "sent" : "received"),
      text_content: messageMeta.text,
      media_caption: messageMeta.mediaCaption,
      quoted_message_id: message.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
      sent_at: coerceTimestamp(message.messageTimestamp),
      raw_payload: message as unknown as Record<string, unknown>,
    },
    { onConflict: "session_id,baileys_message_id" },
  );

  if (error) {
    throw error;
  }
}

async function handleContactsUpsert(userId: string, sessionId: string, contacts: Array<Record<string, any>>) {
  for (const contact of contacts) {
    if (!contact.id) continue;
    await upsertContact(userId, sessionId, {
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

async function handleChatsUpsert(userId: string, sessionId: string, chats: Array<Record<string, any>>) {
  for (const chat of chats) {
    if (!chat.id) continue;
    await upsertChat(userId, sessionId, {
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

async function handleMessagesUpsert(userId: string, sessionId: string, payload: { messages?: WAMessage[] }) {
  for (const message of payload.messages || []) {
    await upsertMessage(userId, sessionId, message);
  }
}

async function handleMessagesUpdate(userId: string, sessionId: string, updates: Array<Record<string, any>>) {
  for (const item of updates) {
    const messageId = item.key?.id;
    if (!messageId) continue;

    const nextStatus = mapAckStatus(item.update?.status);
    if (!nextStatus) continue;

    const patch: Record<string, unknown> = { message_status: nextStatus };
    if (nextStatus === "delivered") patch.delivered_at = new Date().toISOString();
    if (nextStatus === "read") patch.read_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("whatsapp_messages")
      .update(patch)
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .eq("baileys_message_id", messageId);

    if (error) {
      throw error;
    }
  }
}

function clearReconnectTimer(key: string) {
  const timer = reconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(key);
  }
}

async function scheduleReconnect(userId: string, sessionId: string) {
  const key = sessionRuntimeKey(userId, sessionId);
  if (manualDisconnects.has(key) || reconnectTimers.has(key)) {
    return;
  }

  const timer = setTimeout(() => {
    reconnectTimers.delete(key);
    connectSession(userId, sessionId).catch((error) => {
      logger.error({ error, sessionId }, "Failed to reconnect WhatsApp session");
    });
  }, 3000);

  reconnectTimers.set(key, timer);
}

export async function connectSession(userId: string, sessionId: string) {
  const key = sessionRuntimeKey(userId, sessionId);
  const existing = runtimes.get(key);
  if (existing) {
    return existing;
  }

  const session = await getSession(userId, sessionId);
  const authStore = new DatabaseAuthStore(userId, sessionId);
  const authState = await authStore.load();
  const { version } = await fetchLatestBaileysVersion();
  const sessionLogger = logger.child({ sessionId, userId });

  await updateSessionRow(userId, sessionId, {
    session_status: "connecting",
    error_message: null,
  });

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

  const runtime: Runtime = {
    userId,
    sessionId,
    socket,
    authStore,
    authState,
    logger: sessionLogger,
  };

  runtimes.set(key, runtime);
  clearReconnectTimer(key);

  socket.ev.on("creds.update", async (update: Record<string, unknown>) => {
    Object.assign(authState.creds, update);
    await authStore.saveCreds(authState.creds);
  });

  socket.ev.on("connection.update", async (update: Record<string, any>) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      await updateSessionRow(userId, sessionId, {
        session_status: "qr_ready",
        qr_payload: qr,
        qr_expires_at: new Date(Date.now() + 60_000).toISOString(),
        error_message: null,
      });
    }

    if (connection === "open") {
      await updateSessionRow(userId, sessionId, {
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
        await updateSessionRow(userId, sessionId, {
          session_status: "disconnected",
          error_message: null,
          qr_payload: null,
          qr_expires_at: null,
        });
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        await authStore.clear();
        await updateSessionRow(userId, sessionId, {
          session_status: "disconnected",
          error_message: "Sessao desconectada do WhatsApp. Gere um novo QR Code.",
          qr_payload: null,
          qr_expires_at: null,
        });
        return;
      }

      await updateSessionRow(userId, sessionId, {
        session_status: "reconnecting",
        error_message: lastDisconnect?.error?.message || "Conexao perdida. Tentando reconectar.",
      });
      await scheduleReconnect(userId, sessionId);
    }
  });

  socket.ev.on("messages.upsert", async (payload: { messages?: WAMessage[] }) => {
    await handleMessagesUpsert(userId, sessionId, payload);
  });

  socket.ev.on("messages.update", async (updates: Array<Record<string, any>>) => {
    await handleMessagesUpdate(userId, sessionId, updates);
  });

  socket.ev.on("chats.upsert", async (chats: Array<Record<string, any>>) => {
    await handleChatsUpsert(userId, sessionId, chats);
  });

  socket.ev.on("contacts.upsert", async (contacts: Array<Record<string, any>>) => {
    await handleContactsUpsert(userId, sessionId, contacts);
  });

  return runtime;
}

export async function ensureSession(userId: string, name = "Sessao principal") {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existing && existing.length > 0) {
    return existing[0] as SessionRow;
  }

  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .insert({
      user_id: userId,
      name,
      session_status: "disconnected",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as SessionRow;
}

export async function getSessions(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return Promise.all((data as SessionRow[]).map(async (session) => ({
    ...session,
    qr_data_url: session.qr_payload ? await QRCode.toDataURL(session.qr_payload, { margin: 1, width: 280 }) : null,
  })));
}

export async function disconnectSession(userId: string, sessionId: string) {
  const key = sessionRuntimeKey(userId, sessionId);
  const runtime = runtimes.get(key);
  manualDisconnects.add(key);
  clearReconnectTimer(key);

  if (runtime?.socket?.end) {
    runtime.socket.end(new Error("Manual disconnect"));
  } else if (runtime?.socket?.ws?.close) {
    runtime.socket.ws.close();
  }

  runtimes.delete(key);
  await updateSessionRow(userId, sessionId, {
    session_status: "disconnected",
    qr_payload: null,
    qr_expires_at: null,
    error_message: null,
  });
}

export async function listChats(userId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_chats")
    .select("id, chat_jid, subject, is_group, unread_count, last_message_at, metadata, updated_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function listMessages(userId: string, sessionId: string, chatJid: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, baileys_message_id, chat_jid, sender_jid, recipient_jid, push_name, message_direction, message_type, message_status, text_content, media_caption, sent_at, delivered_at, read_at, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("chat_jid", chatJid)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    throw error;
  }

  return data;
}

export async function sendTextMessage(userId: string, sessionId: string, chatJid: string, text: string) {
  const key = sessionRuntimeKey(userId, sessionId);
  let runtime = runtimes.get(key);

  if (!runtime) {
    runtime = await connectSession(userId, sessionId);
  }

  const message = await runtime.socket.sendMessage(chatJid, { text });
  await upsertMessage(userId, sessionId, message, "sent");
  return message;
}
