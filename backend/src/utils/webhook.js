import crypto from "crypto";

const safeString = (value) => String(value || "").trim();

export const verifyWhatsAppSignature = ({ rawBody = "", signatureHeader = "", appSecret = "" } = {}) => {
  const secret = safeString(appSecret);
  if (!secret) {
    return { ok: true, reason: "signature-check-disabled" };
  }

  const signature = safeString(signatureHeader);
  if (!signature || !signature.startsWith("sha256=")) {
    return { ok: false, reason: "missing-or-invalid-signature-header" };
  }

  if (!rawBody) {
    return { ok: false, reason: "missing-raw-body" };
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return { ok: false, reason: "signature-length-mismatch" };
  }

  const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  return isValid ? { ok: true } : { ok: false, reason: "signature-mismatch" };
};

export const extractWhatsAppInboundTextMessages = (payload) => {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const inboundMessages = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      if (!value || typeof value !== "object") {
        continue;
      }

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const message of messages) {
        if (!message || typeof message !== "object") {
          continue;
        }

        const from = safeString(message.from);
        const text = safeString(message?.text?.body);
        if (!from || !text) {
          continue;
        }

        const contact = contacts.find((candidate) => candidate?.wa_id === message.from) || {};
        const name = safeString(contact?.profile?.name) || "Unknown";
        inboundMessages.push({
          phone: from,
          text,
          name
        });
      }
    }
  }

  return inboundMessages;
};
