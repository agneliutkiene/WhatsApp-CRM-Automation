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

export const getDb = () => {
  ensureDataFile();
  const content = fs.readFileSync(dataFilePath, "utf8");
  return JSON.parse(content);
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
