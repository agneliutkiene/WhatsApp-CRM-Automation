import express from "express";
import { ingestWordPressLead, receiveInboundMessage, sendSetupTestMessage } from "../services/crmService.js";
import {
  getWhatsAppConnectionStatus,
  markWebhookConfirmed,
  markWhatsAppTestSent,
  getPublicWhatsAppConfig,
  getWhatsAppVerifyToken,
  updateWhatsAppConfig
} from "../services/whatsappService.js";

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

integrationsRouter.get("/whatsapp/config", (req, res) => {
  const data = getPublicWhatsAppConfig();
  return res.json({ data });
});

integrationsRouter.get("/whatsapp/status", (req, res) => {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = req.get("host");
  const requestBaseUrl = host ? `${proto}://${host}` : "";
  const data = getWhatsAppConnectionStatus({ requestBaseUrl });
  return res.json({ data });
});

integrationsRouter.patch("/whatsapp/config", (req, res) => {
  const data = updateWhatsAppConfig({
    businessPhone: req.body.businessPhone,
    phoneNumberId: req.body.phoneNumberId,
    accessToken: req.body.accessToken,
    verifyToken: req.body.verifyToken
  });
  return res.json({ data });
});

integrationsRouter.post("/whatsapp/confirm-webhook", (req, res) => {
  const data = markWebhookConfirmed();
  return res.json({ data });
});

integrationsRouter.post("/whatsapp/test-message", async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const text = String(req.body.text || "This is a WhatsApp CRM setup test message.").trim();

  if (!phone) {
    return res.status(400).json({ error: "phone is required" });
  }

  const data = await sendSetupTestMessage({
    phone,
    text
  });

  if (data?.message?.status !== "FAILED") {
    markWhatsAppTestSent();
  }
  return res.status(201).json({ data });
});

integrationsRouter.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = getWhatsAppVerifyToken();

  if (mode === "subscribe" && token === verifyToken) {
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
