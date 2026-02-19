import express from "express";
import { getAutomationConfig, updateAutomationConfig } from "../services/crmService.js";

export const automationRouter = express.Router();

automationRouter.get("/", (req, res) => {
  const data = getAutomationConfig();
  res.json({ data });
});

automationRouter.patch("/", (req, res) => {
  const data = updateAutomationConfig(req.body || {});
  res.json({ data });
});
