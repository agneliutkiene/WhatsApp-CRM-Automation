import { env } from "../config/env.js";

const isExcludedPath = (path = "") => {
  if (path === "/health") {
    return true;
  }

  if (path.startsWith("/integrations/whatsapp/webhook")) {
    return true;
  }

  return false;
};

export const requireApiAuth = (req, res, next) => {
  if (!env.appPassword) {
    return next();
  }

  if (req.method === "OPTIONS" || isExcludedPath(req.path)) {
    return next();
  }

  const provided = String(req.get("x-app-password") || "").trim();
  if (provided && provided === env.appPassword) {
    return next();
  }

  return res.status(401).json({
    error: "Unauthorized. Provide a valid app password."
  });
};
