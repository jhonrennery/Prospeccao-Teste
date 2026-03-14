import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  connectWhatsAppSession,
  disconnectWhatsAppSession,
  getWhatsAppGatewayStatus,
  listWhatsAppChats,
  listWhatsAppMessages,
  listWhatsAppSessions,
  sendWhatsAppMessage,
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

  const gatewayStatus = useMemo(() => getWhatsAppGatewayStatus(), []);

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
    if (!gatewayStatus.available) {
      setGatewayError(gatewayStatus.reason);
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
    if (!gatewayStatus.available) return;
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
    if (!gatewayStatus.available) return;
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
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" /> WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie o QR Code, acompanhe o status da sessão e veja mensagens enviadas e recebidas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadSessions(true)} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={handleConnect} disabled={connecting}>
            <Wifi className="h-4 w-4 mr-2" /> {connecting ? "Conectando..." : "Gerar QR / Conectar"}
          </Button>
          <Button variant="destructive" onClick={handleDisconnect} disabled={!selectedSessionId}>
            <WifiOff className="h-4 w-4 mr-2" /> Desconectar
          </Button>
        </div>
      </div>

      {gatewayError && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            {gatewayError}
            {!gatewayStatus.available && (
              <span className="block mt-2 text-xs text-muted-foreground">
                Para ambiente publicado, configure `VITE_WHATSAPP_GATEWAY_URL` apontando para o backend do WhatsApp.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Sessão atual
              </CardTitle>
              <CardDescription>
                {selectedSession ? `Sessão: ${selectedSession.name}` : "Nenhuma sessão criada ainda."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSession ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <Badge className={statusMap[selectedSession.session_status].className}>
                      {statusMap[selectedSession.session_status].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Ultima atividade: {formatDateTime(selectedSession.last_seen_at)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-center">
                    {selectedSession.qr_data_url ? (
                      <img
                        src={selectedSession.qr_data_url}
                        alt="QR Code do WhatsApp"
                        className="mx-auto h-64 w-64 rounded-md bg-white p-3 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <QrCode className="h-10 w-10 text-primary/60" />
                        <p className="text-sm">
                          {selectedSession.session_status === "connected"
                            ? "Sessão conectada. Não há QR pendente."
                            : "Clique em conectar para gerar um novo QR Code."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Numero</span>
                      <span className="font-mono text-foreground">{selectedSession.phone_number || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Device JID</span>
                      <span className="font-mono text-[11px] text-foreground truncate max-w-[180px]">
                        {selectedSession.device_jid || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Conectado em</span>
                      <span className="text-foreground">{formatDateTime(selectedSession.last_connected_at)}</span>
                    </div>
                  </div>

                  {selectedSession.error_message && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {selectedSession.error_message}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Clique em conectar para criar a primeira sessão.</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Enviar mensagem</CardTitle>
              <CardDescription>
                Use um chat existente ou informe manualmente um JID como `5511999999999@s.whatsapp.net`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Chat JID manual (opcional)"
                value={newChatJid}
                onChange={(event) => setNewChatJid(event.target.value)}
              />
              <Textarea
                placeholder="Digite sua mensagem"
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                className="min-h-[110px] bg-secondary border-border"
              />
              <Button className="w-full" onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4 mr-2" /> {sending ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="glass-card border-border/60 min-h-[720px]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Conversas
              </CardTitle>
              <CardDescription>{chats.length} chats gravados no banco</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 h-[620px]">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-2">
                  {chats.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
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
                          className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                            isActive
                              ? "border-primary/30 bg-primary/10"
                              : "border-border/60 bg-secondary/20 hover:border-primary/20 hover:bg-secondary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm text-foreground truncate">{getChatTitle(chat)}</div>
                            {chat.unread_count > 0 && (
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {chat.unread_count}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">{chat.chat_jid}</div>
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            {chat.is_group ? "Grupo" : "Direto"} • {formatDateTime(chat.last_message_at)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 min-h-[720px]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Mensagens</CardTitle>
              <CardDescription>
                {selectedChat ? getChatTitle(selectedChat) : "Selecione uma conversa para ver entrada e saida."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 h-[620px]">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem encontrada para este chat.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          message.message_direction === "outbound"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-wide opacity-75 mb-1">
                          {message.message_direction === "outbound" ? "Enviado" : "Recebido"}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{message.text_content || message.media_caption || `[${message.message_type}]`}</div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] opacity-75">
                          <span>{formatDateTime(message.sent_at || message.created_at)}</span>
                          <span className="font-mono">{message.message_status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
