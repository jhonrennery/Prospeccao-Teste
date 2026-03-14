import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  checkWhatsAppGatewayHealth,
  clearWhatsAppGatewayUrl,
  connectWhatsAppSession,
  disconnectWhatsAppSession,
  getWhatsAppGatewayStatus,
  listWhatsAppChats,
  listWhatsAppMessages,
  listWhatsAppSessions,
  sendWhatsAppMessage,
  setWhatsAppGatewayUrl,
  type WhatsAppChat,
  type WhatsAppMessage,
  type WhatsAppSession,
} from "@/lib/whatsapp-gateway";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, QrCode, RefreshCw, Send, Smartphone, Wifi, WifiOff } from "lucide-react";

const statusMap: Record<WhatsAppSession["session_status"], { label: string; className: string }> = {
  disconnected: { label: "Desconectado", className: "bg-secondary text-secondary-foreground" },
  connecting: { label: "Conectando", className: "bg-warning/15 text-warning border-warning/30" },
  qr_ready: { label: "QR pronto", className: "bg-primary/15 text-primary border-primary/30" },
  connected: { label: "Conectado", className: "bg-success/15 text-success border-success/30" },
  reconnecting: { label: "Reconectando", className: "bg-warning/15 text-warning border-warning/30" },
  error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getChatTitle(chat: WhatsAppChat) {
  return chat.subject || chat.chat_jid.replace(/@.+$/, "");
}

export default function WhatsAppPage() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedChatJid, setSelectedChatJid] = useState<string | null>(null);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newChatJid, setNewChatJid] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState(() => getWhatsAppGatewayStatus());
  const [gatewayUrlInput, setGatewayUrlInput] = useState(() => getWhatsAppGatewayStatus().baseUrl || "");

  const resolveGatewayStatus = () => {
    const nextStatus = getWhatsAppGatewayStatus();
    setGatewayStatus(nextStatus);
    return nextStatus;
  };

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chat_jid === selectedChatJid) || null,
    [chats, selectedChatJid],
  );

  const loadSessions = async (keepLoading = false) => {
    if (keepLoading) setLoading(true);
    const currentGatewayStatus = resolveGatewayStatus();
    if (!currentGatewayStatus.available) {
      setGatewayError(currentGatewayStatus.reason);
      setSessions([]);
      if (keepLoading) setLoading(false);
      return;
    }

    try {
      const response = await listWhatsAppSessions();
      setGatewayError(null);
      setSessions(response.sessions);
      if (!selectedSessionId && response.sessions.length > 0) {
        setSelectedSessionId(response.sessions[0].id);
      }
      if (selectedSessionId && !response.sessions.some((session) => session.id === selectedSessionId)) {
        setSelectedSessionId(response.sessions[0]?.id || null);
        setSelectedChatJid(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar sessões do WhatsApp";
      setGatewayError(message);
      if (keepLoading) {
        toast.error(message);
      }
    } finally {
      if (keepLoading) setLoading(false);
    }
  };

  const loadChats = async (sessionId: string) => {
    const currentGatewayStatus = resolveGatewayStatus();
    if (!currentGatewayStatus.available) return;

    try {
      const response = await listWhatsAppChats(sessionId);
      setGatewayError(null);
      setChats(response.chats);
      if (selectedChatJid && !response.chats.some((chat) => chat.chat_jid === selectedChatJid)) {
        setSelectedChatJid(null);
      }
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : "Erro ao carregar conversas");
    }
  };

  const loadMessages = async (sessionId: string, chatJid: string) => {
    const currentGatewayStatus = resolveGatewayStatus();
    if (!currentGatewayStatus.available) return;

    try {
      const response = await listWhatsAppMessages(sessionId, chatJid);
      setGatewayError(null);
      setMessages(response.messages);
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : "Erro ao carregar mensagens");
    }
  };

  useEffect(() => {
    loadSessions(true);
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setChats([]);
      return;
    }

    loadChats(selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId || !selectedChatJid) {
      setMessages([]);
      return;
    }

    loadMessages(selectedSessionId, selectedChatJid);
  }, [selectedSessionId, selectedChatJid]);

  useEffect(() => {
    if (!gatewayStatus.available) {
      setLoading(false);
      setGatewayError(gatewayStatus.reason);
      return;
    }

    const interval = window.setInterval(() => {
      loadSessions();
      if (selectedSessionId) loadChats(selectedSessionId);
      if (selectedSessionId && selectedChatJid) loadMessages(selectedSessionId, selectedChatJid);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [gatewayStatus.available, gatewayStatus.reason, selectedSessionId, selectedChatJid]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await connectWhatsAppSession(selectedSessionId || undefined);
      setGatewayError(null);
      setSessions(response.sessions);
      if (response.session) {
        setSelectedSessionId(response.session.id);
      }
      toast.success("Conexão com WhatsApp iniciada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao iniciar conexão";
      setGatewayError(message);
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedSessionId) return;
    try {
      const response = await disconnectWhatsAppSession(selectedSessionId);
      setGatewayError(null);
      setSessions(response.sessions);
      setChats([]);
      setMessages([]);
      setSelectedChatJid(null);
      toast.success("Sessão desconectada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao desconectar sessão";
      setGatewayError(message);
      toast.error(message);
    }
  };

  const handleSend = async () => {
    if (!selectedSessionId) {
      toast.warning("Conecte uma sessão antes de enviar mensagens");
      return;
    }

    const targetJid = (selectedChatJid || newChatJid).trim();
    if (!targetJid || !newMessage.trim()) {
      toast.warning("Informe o JID do chat e a mensagem");
      return;
    }

    setSending(true);
    try {
      await sendWhatsAppMessage(selectedSessionId, targetJid, newMessage.trim());
      setGatewayError(null);
      setNewMessage("");
      setNewChatJid("");
      setSelectedChatJid(targetJid);
      await loadChats(selectedSessionId);
      await loadMessages(selectedSessionId, targetJid);
      toast.success("Mensagem enviada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem";
      setGatewayError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
            <Smartphone className="h-6 w-6 text-success" /> WhatsApp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Layout inspirado no WhatsApp Web com QR centralizado, conversas na lateral e painel de mensagens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadSessions(true)} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button className="bg-success text-white hover:bg-success/90" onClick={handleConnect} disabled={connecting}>
            <Wifi className="mr-2 h-4 w-4" /> {connecting ? "Conectando..." : "Gerar QR / Conectar"}
          </Button>
          <Button variant="destructive" onClick={handleDisconnect} disabled={!selectedSessionId}>
            <WifiOff className="mr-2 h-4 w-4" /> Desconectar
          </Button>
        </div>
      </div>

      {gatewayError && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            {gatewayError}
            {!gatewayStatus.available && (
              <span className="mt-2 block text-xs text-muted-foreground">
                Para ambiente publicado, configure `VITE_WHATSAPP_GATEWAY_URL` apontando para o backend do WhatsApp.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-[28px] border border-border/60 bg-[#e7ddd6] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.4)]">
        <div className="grid min-h-[780px] xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="border-r border-black/5 bg-[#f7f5f3]">
            <div className="border-b border-black/5 bg-[#f0efec] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedSession?.name || "Sessao principal"}</div>
                  <div className="text-xs text-muted-foreground">{selectedSession?.phone_number || "WhatsApp ainda nao conectado"}</div>
                </div>
                {selectedSession && (
                  <Badge className={statusMap[selectedSession.session_status].className}>
                    {statusMap[selectedSession.session_status].label}
                  </Badge>
                )}
              </div>
            </div>

            <div className="border-b border-black/5 bg-white/80 px-4 py-3">
              <div className="rounded-2xl bg-[#f0efec] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-success/15 p-2 text-success">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">Conversas sincronizadas</div>
                    <div className="text-xs text-muted-foreground">{chats.length} chats gravados no banco</div>
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[640px]">
              <div className="space-y-1 p-2">
                {chats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-white/70 px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma conversa sincronizada ainda.
                  </div>
                ) : (
                  chats.map((chat) => {
                    const isActive = selectedChatJid === chat.chat_jid;
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => setSelectedChatJid(chat.chat_jid)}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                          isActive ? "bg-[#efeae2]" : "hover:bg-[#f2f2f2]"
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-medium text-foreground">{getChatTitle(chat)}</div>
                            <div className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(chat.last_message_at)}</div>
                          </div>
                          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{chat.chat_jid}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">{chat.is_group ? "Grupo" : "Direto"}</div>
                            {chat.unread_count > 0 && (
                              <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-success px-1.5 text-[10px] font-semibold text-white">
                                {chat.unread_count}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-[780px] flex-col bg-[#efeae2]">
            <div className="border-b border-black/5 bg-[#f0efec] px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {selectedChat ? getChatTitle(selectedChat) : "Escaneie o QR Code para conectar"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedChat
                      ? selectedChat.chat_jid
                      : selectedSession?.session_status === "connected"
                        ? "Sessao ativa. Selecione uma conversa para acompanhar as mensagens."
                        : "A experiencia abaixo foi organizada para ficar parecida com o WhatsApp Web."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Chat JID manual"
                    value={newChatJid}
                    onChange={(event) => setNewChatJid(event.target.value)}
                    className="h-10 w-full bg-white lg:w-[280px]"
                  />
                </div>
              </div>
            </div>

            {selectedSession?.qr_data_url || (!selectedChat && selectedSession?.session_status !== "connected") ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
                  <div className="w-full max-w-xl rounded-[32px] border border-black/5 bg-white px-8 py-10 text-center shadow-[0_30px_60px_-35px_rgba(0,0,0,0.35)]">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success">
                      <QrCode className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">Conecte seu WhatsApp</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Escaneie o QR Code abaixo com o seu celular. O quadro fica centralizado como area principal da experiencia, no estilo do WhatsApp Web.
                    </p>

                    <div className="mt-8 flex justify-center">
                      {selectedSession?.qr_data_url ? (
                        <div className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
                          <img
                            src={selectedSession.qr_data_url}
                            alt="QR Code do WhatsApp"
                            className="h-72 w-72 rounded-2xl bg-white p-3"
                          />
                        </div>
                      ) : (
                        <div className="flex h-72 w-72 items-center justify-center rounded-[28px] border border-dashed border-border bg-[#f8f7f6] text-sm text-muted-foreground">
                          Clique em "Gerar QR / Conectar"
                        </div>
                      )}
                    </div>

                    <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#f8f7f6] p-4">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                          {selectedSession ? statusMap[selectedSession.session_status].label : "Aguardando"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#f8f7f6] p-4">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Numero</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{selectedSession?.phone_number || "-"}</div>
                      </div>
                      <div className="rounded-2xl bg-[#f8f7f6] p-4">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ultima atividade</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{formatDateTime(selectedSession?.last_seen_at || null)}</div>
                      </div>
                    </div>

                    {selectedSession?.error_message && (
                      <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {selectedSession.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="flex-1 px-6 py-6"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 25px 25px, rgba(255,255,255,0.35) 2px, transparent 0), linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22))",
                    backgroundSize: "50px 50px, 100% 100%",
                  }}
                >
                  <ScrollArea className="h-[560px] pr-2">
                    <div className="space-y-3">
                      {messages.length === 0 ? (
                        <div className="mx-auto mt-12 max-w-md rounded-[28px] bg-white/90 px-6 py-8 text-center shadow-sm">
                          <MessageSquare className="mx-auto h-10 w-10 text-success/70" />
                          <p className="mt-3 text-sm text-muted-foreground">
                            Nenhuma mensagem encontrada para este chat ainda.
                          </p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`max-w-[78%] rounded-[18px] px-4 py-3 text-sm shadow-sm ${
                              message.message_direction === "outbound"
                                ? "ml-auto bg-[#d9fdd3] text-[#111b21]"
                                : "bg-white text-[#111b21]"
                            }`}
                          >
                            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              {message.message_direction === "outbound" ? "Enviado" : "Recebido"}
                            </div>
                            <div className="whitespace-pre-wrap break-words">
                              {message.text_content || message.media_caption || `[${message.message_type}]`}
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
                              <span>{formatDateTime(message.sent_at || message.created_at)}</span>
                              <span className="font-mono">{message.message_status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t border-black/5 bg-[#f0efec] px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Textarea
                      placeholder="Digite sua mensagem"
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      className="min-h-[70px] flex-1 resize-none rounded-3xl border-white bg-white px-5 py-4"
                    />
                    <Button className="h-[54px] rounded-full bg-success px-6 text-white hover:bg-success/90" onClick={handleSend} disabled={sending}>
                      <Send className="mr-2 h-4 w-4" /> {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
