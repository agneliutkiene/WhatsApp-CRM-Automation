import express from "express";
import { env } from "../config/env.js";
import { requireAuthenticatedUser } from "../middleware/sessionAuth.js";
import { ingestWordPressLead, receiveInboundMessage, sendSetupTestMessage } from "../services/crmService.js";
import {
  findUserIdByPhoneNumberId,
  findUserIdByVerifyToken,
  getWhatsAppConnectionStatus,
  markWebhookConfirmed,
  markWhatsAppTestSent,
  getPublicWhatsAppConfig,
  updateWhatsAppConfig
} from "../services/whatsappService.js";
import { extractWhatsAppInboundTextMessages, verifyWhatsAppSignature } from "../utils/webhook.js";

export const integrationsRouter = express.Router();

const isWebhookPath = (path) => path.startsWith("/whatsapp/webhook");
integrationsRouter.use((req, res, next) => {
  if (isWebhookPath(req.path)) {
    return next();
  }
  return requireAuthenticatedUser(req, res, next);
});

const getWebhookPhoneNumberId = (payload) => {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const phoneNumberId = String(change?.value?.metadata?.phone_number_id || "").trim();
      if (phoneNumberId) {
        return phoneNumberId;
      }
    }
  }
  return "";
};

integrationsRouter.post("/wordpress/lead", async (req, res) => {
  const name = String(req.body.name || "Unknown").trim();
  const phone = String(req.body.phone || "").trim();
  const message = String(req.body.message || "").trim();
  const sourceUrl = String(req.body.sourceUrl || "").trim();

  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }

  const data = await ingestWordPressLead({
    userId: req.userId,
    name,
    phone,
    message,
    sourceUrl
  });

  return res.status(201).json({ data });
});

integrationsRouter.get("/whatsapp/config", (req, res) => {
  const data = getPublicWhatsAppConfig(req.userId);
  return res.json({ data });
});

integrationsRouter.get("/whatsapp/status", (req, res) => {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = req.get("host");
  const requestBaseUrl = host ? `${proto}://${host}` : "";
  const data = getWhatsAppConnectionStatus({ userId: req.userId, requestBaseUrl });
  return res.json({ data });
});

integrationsRouter.patch("/whatsapp/config", (req, res) => {
  try {
    const data = updateWhatsAppConfig({
      userId: req.userId,
      businessPhone: req.body.businessPhone,
      phoneNumberId: req.body.phoneNumberId,
      accessToken: req.body.accessToken,
      verifyToken: req.body.verifyToken
    });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Invalid WhatsApp configuration."
    });
  }
});

integrationsRouter.post("/whatsapp/confirm-webhook", (req, res) => {
  const data = markWebhookConfirmed(req.userId);
  return res.json({ data });
});

integrationsRouter.post("/whatsapp/test-message", async (req, res) => {
  const phone = String(req.body.phone || "").trim();
  const text = String(req.body.text || "This is a WhatsApp CRM setup test message.").trim();

  if (!phone) {
    return res.status(400).json({ error: "phone is required" });
  }

  const data = await sendSetupTestMessage({
    userId: req.userId,
    phone,
    text
  });

  if (data?.message?.status !== "FAILED") {
    markWhatsAppTestSent(req.userId);
  }
  return res.status(201).json({ data });
});

integrationsRouter.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const userId = findUserIdByVerifyToken(token);
  if (mode === "subscribe" && userId) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("forbidden");
});

integrationsRouter.post("/whatsapp/webhook", async (req, res) => {
  const signatureCheck = verifyWhatsAppSignature({
    rawBody: req.rawBody,
    signatureHeader: req.get("x-hub-signature-256"),
    appSecret: env.whatsappAppSecret
  });

  if (!signatureCheck.ok) {
    return res.status(401).json({
      error: "Invalid webhook signature.",
      reason: signatureCheck.reason
    });
  }

  const inboundMessages = extractWhatsAppInboundTextMessages(req.body);
  const phoneNumberId = getWebhookPhoneNumberId(req.body);
  const userId = findUserIdByPhoneNumberId(phoneNumberId);

  if (!userId) {
    return res.status(202).json({ received: true, ignored: true, reason: "workspace-not-found" });
  }

  for (const inbound of inboundMessages) {
    await receiveInboundMessage({
      userId,
      phone: inbound.phone,
      name: inbound.name,
      text: inbound.text,
      source: "WHATSAPP_WEBHOOK"
    });
  }

  return res.status(200).json({ received: true });
});
