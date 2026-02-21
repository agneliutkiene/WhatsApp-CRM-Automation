import express from "express";
import { getAnalyticsSnapshot } from "../services/crmService.js";

export const analyticsRouter = express.Router();

analyticsRouter.get("/today", (req, res) => {
  const data = getAnalyticsSnapshot(req.userId);
  res.json({ data });
});
