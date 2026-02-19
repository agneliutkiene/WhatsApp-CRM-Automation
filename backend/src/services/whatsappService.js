import { env } from "../config/env.js";

export const hasWhatsAppCredentials = () =>
  Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId);

export const sendWhatsAppTextMessage = async ({ to, text }) => {
  if (!hasWhatsAppCredentials()) {
    return {
      provider: "mock",
      status: "MOCKED",
      externalId: null
    };
  }

  const url = `https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
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
