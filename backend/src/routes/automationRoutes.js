import express from "express";
import { getAutomationConfig, getAutomationSafetySnapshot, updateAutomationConfig } from "../services/crmService.js";

export const automationRouter = express.Router();

automationRouter.get("/", (req, res) => {
  const data = getAutomationConfig(req.userId);
  res.json({ data });
});

automationRouter.get("/safety", (req, res) => {
  const data = getAutomationSafetySnapshot(req.userId);
  res.json({ data });
});

automationRouter.patch("/", (req, res) => {
  try {
    const data = updateAutomationConfig({
      userId: req.userId,
      nextConfig: req.body || {}
    });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Invalid automation configuration",
      details: error.details || []
    });
  }
});
