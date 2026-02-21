import { AUTH_COOKIE_NAME, getSessionUserByToken } from "../services/authService.js";

const getCookieValue = (cookieHeader, key) => {
  const source = String(cookieHeader || "");
  if (!source) {
    return "";
  }

  const pairs = source.split(";").map((entry) => entry.trim());
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=");
    if (name === key) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
};

export const attachSessionUser = (req, _res, next) => {
  const token = getCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);
  req.sessionToken = token || "";

  if (!token) {
    req.user = null;
    return next();
  }

  const session = getSessionUserByToken(token);
  req.user = session?.user || null;
  req.userId = session?.userId || null;
  return next();
};

export const requireAuthenticatedUser = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }
  return next();
};
