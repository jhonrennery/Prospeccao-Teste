import express from "express";
import cors from "cors";
import { authenticateRequest } from "./auth.js";
import { env } from "./config.js";
import { connectSession, disconnectSession, ensureSession, getSessions, listChats, listMessages, sendTextMessage } from "./whatsapp-service.js";

const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin, credentials: false }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/whatsapp", async (req, res, next) => {
  try {
    res.locals.user = await authenticateRequest(req);
    next();
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
});

app.get("/api/whatsapp/sessions", async (_req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    res.json({ sessions: await getSessions(user.id, user.accessToken) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list sessions" });
  }
});

app.post("/api/whatsapp/sessions/connect", async (req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    const session = req.body?.sessionId ? { id: req.body.sessionId } : await ensureSession(user.id, user.accessToken, req.body?.name);
    await connectSession(user.id, session.id, user.accessToken);
    const sessions = await getSessions(user.id, user.accessToken);
    res.json({ session: sessions.find((item) => item.id === session.id) || null, sessions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to connect session" });
  }
});

app.post("/api/whatsapp/sessions/:sessionId/disconnect", async (req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    await disconnectSession(user.id, req.params.sessionId, user.accessToken);
    res.json({ sessions: await getSessions(user.id, user.accessToken) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to disconnect session" });
  }
});

app.get("/api/whatsapp/chats", async (req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    res.json({ chats: await listChats(user.id, sessionId, user.accessToken) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list chats" });
  }
});

app.get("/api/whatsapp/messages", async (req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    const sessionId = String(req.query.sessionId || "").trim();
    const chatJid = String(req.query.chatJid || "").trim();
    if (!sessionId || !chatJid) return res.status(400).json({ error: "sessionId and chatJid are required" });
    res.json({ messages: await listMessages(user.id, sessionId, chatJid, user.accessToken) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list messages" });
  }
});

app.post("/api/whatsapp/messages/send", async (req, res) => {
  try {
    const user = res.locals.user as { id: string; accessToken: string };
    const sessionId = String(req.body?.sessionId || "").trim();
    const chatJid = String(req.body?.chatJid || "").trim();
    const text = String(req.body?.text || "").trim();
    if (!sessionId || !chatJid || !text) return res.status(400).json({ error: "sessionId, chatJid and text are required" });
    res.json({ message: await sendTextMessage(user.id, sessionId, chatJid, text, user.accessToken) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send message" });
  }
});

app.listen(env.port, () => {
  console.log(`WhatsApp gateway listening on port ${env.port}`);
});
