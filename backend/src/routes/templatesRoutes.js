import express from "express";
import { createOrUpdateTemplate, getTemplates } from "../services/crmService.js";

export const templatesRouter = express.Router();

templatesRouter.get("/", (req, res) => {
  const data = getTemplates(req.userId);
  res.json({ data });
});

templatesRouter.post("/", (req, res) => {
  const name = String(req.body.name || "").trim();
  const body = String(req.body.body || "").trim();
  const category = req.body.category || "CUSTOM";

  if (!name || !body) {
    return res.status(400).json({ error: "name and body are required" });
  }

  const data = createOrUpdateTemplate({
    userId: req.userId,
    name,
    body,
    category
  });

  return res.status(201).json({ data });
});

templatesRouter.patch("/:id", (req, res) => {
  const data = createOrUpdateTemplate({
    userId: req.userId,
    id: req.params.id,
    name: req.body.name,
    body: req.body.body,
    category: req.body.category
  });

  return res.json({ data });
});
