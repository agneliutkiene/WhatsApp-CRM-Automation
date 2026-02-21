import crypto from "crypto";
import { env } from "../config/env.js";
import { createId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";
import { getDb, getOrCreateWorkspace, saveDb } from "../utils/store.js";

export const AUTH_COOKIE_NAME = "wa_crm_session";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) => String(value || "").trim();

const hashToken = (token) => crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
};

const verifyPassword = (password, encodedHash) => {
  const [algo, salt, expected] = String(encodedHash || "").split(":");
  if (algo !== "scrypt" || !salt || !expected) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const derivedBuffer = Buffer.from(derived, "hex");

  if (expectedBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, derivedBuffer);
};

const createSessionToken = () => crypto.randomBytes(32).toString("base64url");

const getSessionMaxAgeSeconds = () => env.authSessionDays * 24 * 60 * 60;

const pruneExpiredSessions = (db) => {
  const now = Date.now();
  db.authSessions = (db.authSessions || []).filter((session) => {
    const expiresAt = new Date(session.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null
});

const appendSetCookie = (res, cookieValue) => {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookieValue]);
    return;
  }

  res.setHeader("Set-Cookie", [current, cookieValue]);
};

export const setAuthCookie = (res, token) => {
  const flags = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${getSessionMaxAgeSeconds()}`
  ];

  if (env.nodeEnv === "production") {
    flags.push("Secure");
  }

  appendSetCookie(res, flags.join("; "));
};

export const clearAuthCookie = (res) => {
  const flags = [`${AUTH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (env.nodeEnv === "production") {
    flags.push("Secure");
  }
  appendSetCookie(res, flags.join("; "));
};

const validateRegistrationInput = ({ name, email, password }) => {
  if (!normalizeName(name)) {
    const error = new Error("Name is required.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  if (!emailLooksValid) {
    const error = new Error("Valid email is required.");
    error.statusCode = 400;
    throw error;
  }

  if (String(password || "").length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.statusCode = 400;
    throw error;
  }
};

const createSession = (db, userId) => {
  pruneExpiredSessions(db);
  const token = createSessionToken();
  const now = Date.now();
  const session = {
    id: createId("authsess"),
    userId,
    tokenHash: hashToken(token),
    createdAt: nowIso(),
    expiresAt: new Date(now + getSessionMaxAgeSeconds() * 1000).toISOString()
  };
  db.authSessions.push(session);
  return { token, session };
};

export const registerAccount = ({ name, email, password }) => {
  validateRegistrationInput({ name, email, password });

  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const exists = db.users.some((entry) => normalizeEmail(entry.email) === normalizedEmail);
  if (exists) {
    const error = new Error("Account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const now = nowIso();
  const user = {
    id: createId("user"),
    name: normalizeName(name),
    email: normalizedEmail,
    passwordHash: hashPassword(String(password)),
    createdAt: now,
    lastLoginAt: now
  };

  const shouldMigrateLegacy = db.users.length === 0;
  db.users.push(user);
  getOrCreateWorkspace(db, user.id, { migrateLegacy: shouldMigrateLegacy });

  const { token } = createSession(db, user.id);
  saveDb(db);

  return {
    user: sanitizeUser(user),
    token
  };
};

export const loginAccount = ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const plainPassword = String(password || "");
  if (!normalizedEmail || !plainPassword) {
    const error = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const db = getDb();
  const user = db.users.find((entry) => normalizeEmail(entry.email) === normalizedEmail);
  if (!user || !verifyPassword(plainPassword, user.passwordHash)) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  user.lastLoginAt = nowIso();
  getOrCreateWorkspace(db, user.id);
  const { token } = createSession(db, user.id);
  saveDb(db);

  return {
    user: sanitizeUser(user),
    token
  };
};

export const getSessionUserByToken = (token) => {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    return null;
  }

  const db = getDb();
  pruneExpiredSessions(db);
  const tokenHash = hashToken(rawToken);
  const session = db.authSessions.find((entry) => entry.tokenHash === tokenHash);
  if (!session) {
    saveDb(db);
    return null;
  }

  const user = db.users.find((entry) => entry.id === session.userId);
  if (!user) {
    db.authSessions = db.authSessions.filter((entry) => entry.id !== session.id);
    saveDb(db);
    return null;
  }

  // Sliding expiration window.
  session.expiresAt = new Date(Date.now() + getSessionMaxAgeSeconds() * 1000).toISOString();
  saveDb(db);

  return {
    user: sanitizeUser(user),
    userId: user.id
  };
};

export const logoutSessionByToken = (token) => {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    return;
  }

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  db.authSessions = db.authSessions.filter((entry) => entry.tokenHash !== tokenHash);
  saveDb(db);
};
