import { env } from "../config/env.js";
import { getDb, saveDb } from "../utils/store.js";
import { nowIso } from "../utils/time.js";

const getStoredWhatsAppConfig = () => {
  const db = getDb();
  return db.whatsappConfig || {};
};

export const getEffectiveWhatsAppConfig = () => {
  const stored = getStoredWhatsAppConfig();

  return {
    businessPhone: stored.businessPhone || "",
    phoneNumberId: stored.phoneNumberId || env.whatsappPhoneNumberId || "",
    accessToken: stored.accessToken || env.whatsappAccessToken || "",
    verifyToken: stored.verifyToken || env.whatsappVerifyToken || "verify-token"
  };
};

export const getPublicWhatsAppConfig = () => {
  const effective = getEffectiveWhatsAppConfig();
  const stored = getStoredWhatsAppConfig();
  return {
    businessPhone: effective.businessPhone,
    phoneNumberId: effective.phoneNumberId,
    verifyToken: effective.verifyToken,
    hasAccessToken: Boolean(effective.accessToken),
    isConnected: Boolean(effective.accessToken && effective.phoneNumberId),
    webhookConfirmedAt: stored.webhookConfirmedAt || null,
    lastTestSentAt: stored.lastTestSentAt || null
  };
};

export const updateWhatsAppConfig = (nextConfig = {}) => {
  const db = getDb();
  const current = db.whatsappConfig || {};

  db.whatsappConfig = {
    businessPhone: String(nextConfig.businessPhone ?? current.businessPhone ?? "").trim(),
    phoneNumberId: String(nextConfig.phoneNumberId ?? current.phoneNumberId ?? "").trim(),
    accessToken: String(nextConfig.accessToken ?? current.accessToken ?? "").trim(),
    verifyToken: String(nextConfig.verifyToken ?? current.verifyToken ?? "").trim(),
    webhookConfirmedAt: current.webhookConfirmedAt || null,
    lastTestSentAt: current.lastTestSentAt || null
  };

  saveDb(db);
  return getPublicWhatsAppConfig();
};

export const markWebhookConfirmed = () => {
  const db = getDb();
  db.whatsappConfig = {
    ...(db.whatsappConfig || {}),
    webhookConfirmedAt: nowIso()
  };
  saveDb(db);
  return getPublicWhatsAppConfig();
};

export const markWhatsAppTestSent = () => {
  const db = getDb();
  db.whatsappConfig = {
    ...(db.whatsappConfig || {}),
    lastTestSentAt: nowIso()
  };
  saveDb(db);
  return getPublicWhatsAppConfig();
};

export const getWhatsAppConnectionStatus = ({ requestBaseUrl = "" } = {}) => {
  const config = getPublicWhatsAppConfig();
  const webhookUrl = `${requestBaseUrl || env.appBaseUrl || ""}/api/integrations/whatsapp/webhook`.replace(/([^:]\/)\/+/g, "$1");
  const connected = Boolean(config.isConnected);
  const hasVerifyToken = Boolean(config.verifyToken);
  const webhookConfirmed = Boolean(config.webhookConfirmedAt);
  const testMessageSent = Boolean(config.lastTestSentAt);

  return {
    connected,
    hasVerifyToken,
    webhookConfirmed,
    testMessageSent,
    completed: connected && webhookConfirmed && testMessageSent,
    webhookUrl,
    verifyToken: config.verifyToken,
    lastTestSentAt: config.lastTestSentAt,
    webhookConfirmedAt: config.webhookConfirmedAt
  };
};

export const hasWhatsAppCredentials = () => {
  const config = getEffectiveWhatsAppConfig();
  return Boolean(config.accessToken && config.phoneNumberId);
};

export const getWhatsAppVerifyToken = () => getEffectiveWhatsAppConfig().verifyToken;

export const sendWhatsAppTextMessage = async ({ to, text }) => {
  const config = getEffectiveWhatsAppConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      provider: "mock",
      status: "MOCKED",
      externalId: null
    };
  }

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: text
      }
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`WhatsApp API error ${response.status}: ${payload}`);
  }

  const payload = await response.json();
  return {
    provider: "meta-whatsapp-cloud",
    status: "SENT",
    externalId: payload?.messages?.[0]?.id || null
  };
};
