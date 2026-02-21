import express from "express";
import {
  addConversationNote,
  getConversationDetails,
  getConversations,
  getPendingFollowUps,
  receiveInboundMessage,
  sendManualMessage,
  updateConversation
} from "../services/crmService.js";

export const conversationsRouter = express.Router();

conversationsRouter.get("/", (req, res) => {
  const data = getConversations({
    userId: req.userId,
    state: req.query.state,
    search: req.query.search
  });

  res.json({ data });
});

conversationsRouter.get("/follow-ups/pending", (req, res) => {
  const data = getPendingFollowUps(req.userId);
  res.json({ data });
});

conversationsRouter.get("/:id", (req, res) => {
  const data = getConversationDetails({
    userId: req.userId,
    conversationId: req.params.id
  });
  if (!data) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.json({ data });
});

conversationsRouter.patch("/:id", (req, res) => {
  try {
    const { state, followUpAt } = req.body;
    const data = updateConversation({
      userId: req.userId,
      conversationId: req.params.id,
      state,
      followUpAt
    });

    if (!data) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Unable to update conversation"
    });
  }
});

conversationsRouter.post("/:id/notes", (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Note text is required" });
  }

  const data = addConversationNote({
    userId: req.userId,
    conversationId: req.params.id,
    text
  });

  if (!data) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.status(201).json({ data });
});

conversationsRouter.post("/:id/messages", async (req, res) => {
  const text = String(req.body.text || "").trim();
  const templateId = req.body.templateId || null;

  if (!text) {
    return res.status(400).json({ error: "Message text is required" });
  }

  const data = await sendManualMessage({
    userId: req.userId,
    conversationId: req.params.id,
    text,
    templateId
  });

  if (!data) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.status(201).json({ data });
});

conversationsRouter.post("/ingest/inbound", async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const name = String(req.body.name || "Unknown").trim();
  const text = String(req.body.text || "").trim();

  if (!phone || !text) {
    return res.status(400).json({ error: "phone and text are required" });
  }

  const data = await receiveInboundMessage({
    userId: req.userId,
    phone,
    name,
    text,
    source: "MANUAL_TEST"
  });

  return res.status(201).json({ data });
});
