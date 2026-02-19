import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defaultData } from "../data/defaultData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFilePath = path.resolve(__dirname, "../data/db.json");

const ensureDataFile = () => {
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify(defaultData, null, 2), "utf8");
  }
};

const ensureDbShape = (db) => {
  let changed = false;

  if (!db.whatsappConfig) {
    db.whatsappConfig = {
      businessPhone: "",
      phoneNumberId: "",
      accessToken: "",
      verifyToken: ""
    };
    changed = true;
  }

  if (typeof db.whatsappConfig.businessPhone !== "string") {
    db.whatsappConfig.businessPhone = "";
    changed = true;
  }
  if (typeof db.whatsappConfig.phoneNumberId !== "string") {
    db.whatsappConfig.phoneNumberId = "";
    changed = true;
  }
  if (typeof db.whatsappConfig.accessToken !== "string") {
    db.whatsappConfig.accessToken = "";
    changed = true;
  }
  if (typeof db.whatsappConfig.verifyToken !== "string") {
    db.whatsappConfig.verifyToken = "";
    changed = true;
  }

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
