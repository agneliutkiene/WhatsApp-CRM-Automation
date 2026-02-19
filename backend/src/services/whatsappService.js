import { env } from "../config/env.js";
import { getDb, saveDb } from "../utils/store.js";

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
  return {
    businessPhone: effective.businessPhone,
    phoneNumberId: effective.phoneNumberId,
    verifyToken: effective.verifyToken,
    hasAccessToken: Boolean(effective.accessToken),
    isConnected: Boolean(effective.accessToken && effective.phoneNumberId)
  };
};

export const updateWhatsAppConfig = (nextConfig = {}) => {
  const db = getDb();
  const current = db.whatsappConfig || {};

  db.whatsappConfig = {
    businessPhone: String(nextConfig.businessPhone ?? current.businessPhone ?? "").trim(),
    phoneNumberId: String(nextConfig.phoneNumberId ?? current.phoneNumberId ?? "").trim(),
    accessToken: String(nextConfig.accessToken ?? current.accessToken ?? "").trim(),
    verifyToken: String(nextConfig.verifyToken ?? current.verifyToken ?? "").trim()
  };

  saveDb(db);
  return getPublicWhatsAppConfig();
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
