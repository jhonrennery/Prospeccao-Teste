import { supabase } from "@/integrations/supabase/client";

function getGatewayBaseUrl() {
  const configured = import.meta.env.VITE_WHATSAPP_GATEWAY_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalHost) {
      return `${protocol}//${hostname}:3001`;
    }

    return null;
  }

  return "http://localhost:3001";
}

export function getWhatsAppGatewayStatus() {
  const baseUrl = getGatewayBaseUrl();

  if (!baseUrl) {
    return {
      available: false,
      baseUrl: null,
      reason: "Defina `VITE_WHATSAPP_GATEWAY_URL` para usar o gateway fora do ambiente local.",
    };
  }

  return {
    available: true,
    baseUrl,
    reason: null,
  };
}

export interface WhatsAppSession {
  id: string;
  name: string;
  phone_number: string | null;
  device_jid: string | null;
  session_status: "disconnected" | "connecting" | "qr_ready" | "connected" | "reconnecting" | "error";
  qr_payload: string | null;
  qr_data_url: string | null;
  qr_expires_at: string | null;
  last_connected_at: string | null;
  last_seen_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppChat {
  id: string;
  chat_jid: string;
  subject: string | null;
  is_group: boolean;
  unread_count: number;
  last_message_at: string | null;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  baileys_message_id: string;
  chat_jid: string;
  sender_jid: string | null;
  recipient_jid: string | null;
  push_name: string | null;
  message_direction: "inbound" | "outbound";
  message_type: string;
  message_status: string;
  text_content: string | null;
  media_caption: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const gateway = getWhatsAppGatewayStatus();
  if (!gateway.available || !gateway.baseUrl) {
    throw new Error(gateway.reason || "Gateway do WhatsApp nao configurado.");
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  let response: Response;
  try {
    response = await fetch(`${gateway.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error(`Nao foi possivel conectar ao gateway do WhatsApp em ${gateway.baseUrl}.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao acessar gateway do WhatsApp");
  }

  return payload as T;
}

export async function listWhatsAppSessions() {
  return gatewayFetch<{ sessions: WhatsAppSession[] }>("/api/whatsapp/sessions");
}

export async function connectWhatsAppSession(sessionId?: string) {
  return gatewayFetch<{ session: WhatsAppSession | null; sessions: WhatsAppSession[] }>("/api/whatsapp/sessions/connect", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function disconnectWhatsAppSession(sessionId: string) {
  return gatewayFetch<{ sessions: WhatsAppSession[] }>(`/api/whatsapp/sessions/${sessionId}/disconnect`, {
    method: "POST",
  });
}

export async function listWhatsAppChats(sessionId: string) {
  return gatewayFetch<{ chats: WhatsAppChat[] }>(`/api/whatsapp/chats?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function listWhatsAppMessages(sessionId: string, chatJid: string) {
  return gatewayFetch<{ messages: WhatsAppMessage[] }>(
    `/api/whatsapp/messages?sessionId=${encodeURIComponent(sessionId)}&chatJid=${encodeURIComponent(chatJid)}`,
  );
}

export async function sendWhatsAppMessage(sessionId: string, chatJid: string, text: string) {
  return gatewayFetch<{ message: unknown }>("/api/whatsapp/messages/send", {
    method: "POST",
    body: JSON.stringify({ sessionId, chatJid, text }),
  });
}
