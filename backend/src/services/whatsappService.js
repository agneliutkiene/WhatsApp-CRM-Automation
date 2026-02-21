import { env } from "../config/env.js";
import {
  findWorkspaceByPhoneNumberId,
  findWorkspaceByVerifyToken,
  getDb,
  getOrCreateWorkspace,
  saveDb
} from "../utils/store.js";
import { nowIso } from "../utils/time.js";

const getStoredWhatsAppConfig = (db, userId) => {
  const workspace = getOrCreateWorkspace(db, userId);
  return workspace.whatsappConfig || {};
};

export const getEffectiveWhatsAppConfig = (userId) => {
  const db = getDb();
  const stored = getStoredWhatsAppConfig(db, userId);

  return {
    businessPhone: stored.businessPhone || "",
    phoneNumberId: stored.phoneNumberId || env.whatsappPhoneNumberId || "",
    accessToken: stored.accessToken || env.whatsappAccessToken || "",
    verifyToken: stored.verifyToken || env.whatsappVerifyToken || "verify-token"
  };
};

export const getPublicWhatsAppConfig = (userId) => {
  const effective = getEffectiveWhatsAppConfig(userId);
  const db = getDb();
  const stored = getStoredWhatsAppConfig(db, userId);
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

export const updateWhatsAppConfig = ({ userId, ...nextConfig } = {}) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const current = workspace.whatsappConfig || {};

  workspace.whatsappConfig = {
    businessPhone: String(nextConfig.businessPhone ?? current.businessPhone ?? "").trim(),
    phoneNumberId: String(nextConfig.phoneNumberId ?? current.phoneNumberId ?? "").trim(),
    accessToken: String(nextConfig.accessToken ?? current.accessToken ?? "").trim(),
    verifyToken: String(nextConfig.verifyToken ?? current.verifyToken ?? "").trim(),
    webhookConfirmedAt: current.webhookConfirmedAt || null,
    lastTestSentAt: current.lastTestSentAt || null
  };

  saveDb(db);
  return getPublicWhatsAppConfig(userId);
};

export const markWebhookConfirmed = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  workspace.whatsappConfig = {
    ...(workspace.whatsappConfig || {}),
    webhookConfirmedAt: nowIso()
  };
  saveDb(db);
  return getPublicWhatsAppConfig(userId);
};

export const markWhatsAppTestSent = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  workspace.whatsappConfig = {
    ...(workspace.whatsappConfig || {}),
    lastTestSentAt: nowIso()
  };
  saveDb(db);
  return getPublicWhatsAppConfig(userId);
};

export const getWhatsAppConnectionStatus = ({ userId, requestBaseUrl = "" } = {}) => {
  const config = getPublicWhatsAppConfig(userId);
  const webhookUrl = `${requestBaseUrl || env.appBaseUrl || ""}/api/integrations/whatsapp/webhook`.replace(
    /([^:]\/)\/+/g,
    "$1"
  );
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

export const hasWhatsAppCredentials = (userId) => {
  const config = getEffectiveWhatsAppConfig(userId);
  return Boolean(config.accessToken && config.phoneNumberId);
};

export const findUserIdByVerifyToken = (verifyToken) => {
  const db = getDb();
  const matched = findWorkspaceByVerifyToken(db, verifyToken);
  return matched?.userId || "";
};

export const findUserIdByPhoneNumberId = (phoneNumberId) => {
  const db = getDb();
  const matched = findWorkspaceByPhoneNumberId(db, phoneNumberId);
  return matched?.userId || "";
};

export const sendWhatsAppTextMessage = async ({ userId, to, text }) => {
  const config = getEffectiveWhatsAppConfig(userId);

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
