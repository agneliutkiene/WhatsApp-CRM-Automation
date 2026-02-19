import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: toNumber(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "verify-token",
  timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  businessHoursStart: process.env.BUSINESS_HOURS_START || "09:00",
  businessHoursEnd: process.env.BUSINESS_HOURS_END || "19:00"
};
