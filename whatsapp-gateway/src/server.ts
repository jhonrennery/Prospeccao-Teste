import express from "express";
import cors from "cors";
import { authenticateRequest } from "./auth.js";
import { env } from "./config.js";
import {
  connectSession,
  disconnectSession,
  ensureSession,
  getSessions,
  listChats,
  listMessages,
  sendTextMessage,
} from "./whatsapp-service.js";

const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin, credentials: false }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/whatsapp", async (req, res, next) => {
  try {
    const user = await authenticateRequest(req);
    res.locals.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
});

app.get("/api/whatsapp/sessions", async (_req, res) => {
  try {
    const user = res.locals.user as { id: string };
    const sessions = await getSessions(user.id);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list sessions" });
  }
});

app.post("/api/whatsapp/sessions/connect", async (req, res) => {
  try {
    const user = res.locals.user as { id: string };
    const session = req.body?.sessionId ? { id: req.body.sessionId } : await ensureSession(user.id, req.body?.name);
    await connectSession(user.id, session.id);
    const sessions = await getSessions(user.id);
    res.json({ session: sessions.find((item) => item.id === session.id) || null, sessions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to connect session" });
  }
});

app.post("/api/whatsapp/sessions/:sessionId/disconnect", async (req, res) => {
  try {
    const user = res.locals.user as { id: string };
    await disconnectSession(user.id, req.params.sessionId);
    const sessions = await getSessions(user.id);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to disconnect session" });
  }
});

app.get("/api/whatsapp/chats", async (req, res) => {
  try {
    const user = res.locals.user as { id: string };
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const chats = await listChats(user.id, sessionId);
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list chats" });
  }
});

app.get("/api/whatsapp/messages", async (req, res) => {
  try {
    const user = res.locals.user as { id: string };
    const sessionId = String(req.query.sessionId || "").trim();
    const chatJid = String(req.query.chatJid || "").trim();
    if (!sessionId || !chatJid) {
      res.status(400).json({ error: "sessionId and chatJid are required" });
      return;
    }

    const messages = await listMessages(user.id, sessionId, chatJid);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list messages" });
  }
});

app.post("/api/whatsapp/messages/send", async (req, res) => {
  try {
    const user = res.locals.user as { id: string };
    const sessionId = String(req.body?.sessionId || "").trim();
    const chatJid = String(req.body?.chatJid || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!sessionId || !chatJid || !text) {
      res.status(400).json({ error: "sessionId, chatJid and text are required" });
      return;
    }

    const message = await sendTextMessage(user.id, sessionId, chatJid, text);
    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send message" });
  }
});

app.listen(env.port, () => {
  console.log(`WhatsApp gateway listening on port ${env.port}`);
});
