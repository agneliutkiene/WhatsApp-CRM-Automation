import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { extractWhatsAppInboundTextMessages, verifyWhatsAppSignature } from "../src/utils/webhook.js";

test("verifyWhatsAppSignature passes when app secret is not configured", () => {
  const result = verifyWhatsAppSignature({
    rawBody: JSON.stringify({ any: "payload" }),
    signatureHeader: "",
    appSecret: ""
  });

  assert.equal(result.ok, true);
});

test("verifyWhatsAppSignature validates Meta signature when secret is configured", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" });
  const secret = "test-secret";
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

  const result = verifyWhatsAppSignature({
    rawBody: body,
    signatureHeader: signature,
    appSecret: secret
  });

  assert.equal(result.ok, true);
});

test("verifyWhatsAppSignature rejects invalid signature", () => {
  const result = verifyWhatsAppSignature({
    rawBody: JSON.stringify({ object: "whatsapp_business_account" }),
    signatureHeader: "sha256=invalid",
    appSecret: "test-secret"
  });

  assert.equal(result.ok, false);
});

test("extractWhatsAppInboundTextMessages returns only valid text messages", () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [
                {
                  wa_id: "919811112222",
                  profile: { name: "Aarav" }
                }
              ],
              messages: [
                {
                  from: "919811112222",
                  text: { body: "Hello there" }
                },
                {
                  from: "919800000000",
                  text: {}
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const inbound = extractWhatsAppInboundTextMessages(payload);
  assert.equal(inbound.length, 1);
  assert.deepEqual(inbound[0], {
    phone: "919811112222",
    text: "Hello there",
    name: "Aarav"
  });
});
