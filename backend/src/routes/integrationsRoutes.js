import express from "express";
import { env } from "../config/env.js";
import { ingestWordPressLead, receiveInboundMessage } from "../services/crmService.js";

export const integrationsRouter = express.Router();

integrationsRouter.post("/wordpress/lead", async (req, res) => {
  const name = String(req.body.name || "Unknown").trim();
  const phone = String(req.body.phone || "").trim();
  const message = String(req.body.message || "").trim();
  const sourceUrl = String(req.body.sourceUrl || "").trim();

  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }

  const data = await ingestWordPressLead({
    name,
    phone,
    message,
    sourceUrl
  });

  return res.status(201).json({ data });
});

integrationsRouter.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsappVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("forbidden");
});

integrationsRouter.post("/whatsapp/webhook", async (req, res) => {
  const entries = req.body?.entry || [];

  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};
      const contacts = value?.contacts || [];
      const messages = value?.messages || [];

      for (const message of messages) {
        const contact = contacts.find((c) => c.wa_id === message.from) || {};
        const text = message?.text?.body || "";

        if (!text) {
          continue;
        }

        await receiveInboundMessage({
          phone: message.from,
          name: contact?.profile?.name || "Unknown",
          text,
          source: "WHATSAPP_WEBHOOK"
        });
      }
    }
  }

  return res.status(200).json({ received: true });
});
