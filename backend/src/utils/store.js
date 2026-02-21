import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWorkspaceSeed, defaultData } from "../data/defaultData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveDataFilePath = () => {
  const explicit = String(process.env.DATA_FILE_PATH || "").trim();
  if (explicit) {
    return path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
  }

  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    const homeDir = String(process.env.HOME || "").trim();
    if (homeDir) {
      return path.resolve(homeDir, ".whatsapp-crm", "db.json");
    }
  }

  return path.resolve(__dirname, "../data/db.json");
};

const dataFilePath = resolveDataFilePath();

const LEGACY_WORKSPACE_KEY = "__legacy";

const ensureDataFile = () => {
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify(defaultData, null, 2), "utf8");
  }
};

const ensureWorkspaceShape = (workspace) => {
  let changed = false;
  const base = createWorkspaceSeed();

  if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
    return { workspace: base, changed: true };
  }

  const keys = ["conversations", "messages", "templates", "logs"];
  for (const key of keys) {
    if (!Array.isArray(workspace[key])) {
      workspace[key] = base[key];
      changed = true;
    }
  }

  if (!workspace.whatsappConfig || typeof workspace.whatsappConfig !== "object") {
    workspace.whatsappConfig = base.whatsappConfig;
    changed = true;
  }

  if (!workspace.automation || typeof workspace.automation !== "object") {
    workspace.automation = base.automation;
    changed = true;
  }

  for (const [key, value] of Object.entries(base.whatsappConfig)) {
    if (workspace.whatsappConfig[key] === undefined) {
      workspace.whatsappConfig[key] = value;
      changed = true;
    }
  }

  for (const [key, value] of Object.entries(base.automation)) {
    if (workspace.automation[key] === undefined) {
      workspace.automation[key] = value;
      changed = true;
    }
  }

  return { workspace, changed };
};

const hasLegacyWorkspaceData = (db) =>
  Array.isArray(db.conversations) ||
  Array.isArray(db.messages) ||
  Array.isArray(db.templates) ||
  Array.isArray(db.logs) ||
  (db.automation && typeof db.automation === "object") ||
  (db.whatsappConfig && typeof db.whatsappConfig === "object");

const buildLegacyWorkspace = (db) => {
  const base = createWorkspaceSeed();
  return {
    conversations: Array.isArray(db.conversations) ? db.conversations : base.conversations,
    messages: Array.isArray(db.messages) ? db.messages : base.messages,
    templates: Array.isArray(db.templates) ? db.templates : base.templates,
    logs: Array.isArray(db.logs) ? db.logs : base.logs,
    automation: db.automation && typeof db.automation === "object" ? db.automation : base.automation,
    whatsappConfig: db.whatsappConfig && typeof db.whatsappConfig === "object" ? db.whatsappConfig : base.whatsappConfig
  };
};

const ensureDbShape = (db) => {
  let changed = false;

  if (!db || typeof db !== "object" || Array.isArray(db)) {
    return { db: structuredClone(defaultData), changed: true };
  }

  if (!db.meta || typeof db.meta !== "object") {
    db.meta = structuredClone(defaultData.meta);
    changed = true;
  }

  if (!Array.isArray(db.users)) {
    db.users = [];
    changed = true;
  }

  if (!Array.isArray(db.authSessions)) {
    db.authSessions = [];
    changed = true;
  }

  if (!db.workspaces || typeof db.workspaces !== "object" || Array.isArray(db.workspaces)) {
    db.workspaces = {};
    changed = true;
  }

  if (!db.workspaces[LEGACY_WORKSPACE_KEY] && hasLegacyWorkspaceData(db)) {
    db.workspaces[LEGACY_WORKSPACE_KEY] = buildLegacyWorkspace(db);
    changed = true;
  }

  for (const key of Object.keys(db.workspaces)) {
    const result = ensureWorkspaceShape(db.workspaces[key]);
    if (result.changed) {
      db.workspaces[key] = result.workspace;
      changed = true;
    }
  }

  db.users = db.users
    .filter((user) => user && typeof user === "object" && typeof user.id === "string" && typeof user.email === "string")
    .map((user) => ({
      id: String(user.id),
      email: String(user.email).toLowerCase(),
      name: String(user.name || "User"),
      passwordHash: String(user.passwordHash || ""),
      createdAt: String(user.createdAt || new Date().toISOString()),
      lastLoginAt: user.lastLoginAt ? String(user.lastLoginAt) : null
    }));

  const now = Date.now();
  db.authSessions = db.authSessions
    .filter((session) => session && typeof session === "object")
    .filter((session) => typeof session.expiresAt === "string" && new Date(session.expiresAt).getTime() > now)
    .filter((session) => db.users.some((user) => user.id === session.userId))
    .map((session) => ({
      id: String(session.id || ""),
      userId: String(session.userId || ""),
      tokenHash: String(session.tokenHash || ""),
      createdAt: String(session.createdAt || new Date().toISOString()),
      expiresAt: String(session.expiresAt || new Date().toISOString())
    }))
    .filter((session) => session.id && session.userId && session.tokenHash);

  return { db, changed };
};

export const getDb = () => {
  ensureDataFile();
  const content = fs.readFileSync(dataFilePath, "utf8");
  const { db, changed } = ensureDbShape(JSON.parse(content));
  if (changed) {
    saveDb(db);
  }
  return db;
};

export const saveDb = (db) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(db, null, 2), "utf8");
};

export const updateDb = (updater) => {
  const db = getDb();
  const result = updater(db) || db;
  saveDb(result);
  return result;
};

export const getDataFilePath = () => dataFilePath;

export const getOrCreateWorkspace = (db, userId, { migrateLegacy = false } = {}) => {
  if (!db.workspaces || typeof db.workspaces !== "object") {
    db.workspaces = {};
  }

  if (!db.workspaces[userId]) {
    if (migrateLegacy && db.workspaces[LEGACY_WORKSPACE_KEY]) {
      db.workspaces[userId] = structuredClone(db.workspaces[LEGACY_WORKSPACE_KEY]);
      delete db.workspaces[LEGACY_WORKSPACE_KEY];
    } else {
      db.workspaces[userId] = createWorkspaceSeed();
    }
  }

  const result = ensureWorkspaceShape(db.workspaces[userId]);
  db.workspaces[userId] = result.workspace;
  return db.workspaces[userId];
};

export const getWorkspaceByUserId = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  saveDb(db);
  return workspace;
};

export const findWorkspaceByVerifyToken = (db, verifyToken) => {
  const normalized = String(verifyToken || "").trim();
  if (!normalized) {
    return null;
  }

  for (const [userId, workspace] of Object.entries(db.workspaces || {})) {
    if (userId === LEGACY_WORKSPACE_KEY) {
      continue;
    }
    if (String(workspace?.whatsappConfig?.verifyToken || "").trim() === normalized) {
      return { userId, workspace };
    }
  }

  return null;
};

export const findWorkspaceByPhoneNumberId = (db, phoneNumberId) => {
  const normalized = String(phoneNumberId || "").trim();
  if (!normalized) {
    return null;
  }

  for (const [userId, workspace] of Object.entries(db.workspaces || {})) {
    if (userId === LEGACY_WORKSPACE_KEY) {
      continue;
    }
    if (String(workspace?.whatsappConfig?.phoneNumberId || "").trim() === normalized) {
      return { userId, workspace };
    }
  }

  return null;
};
