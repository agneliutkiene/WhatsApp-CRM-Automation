import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { requireApiAuth } from "./middleware/apiAuth.js";
import { conversationsRouter } from "./routes/conversationsRoutes.js";
import { templatesRouter } from "./routes/templatesRoutes.js";
import { automationRouter } from "./routes/automationRoutes.js";
import { analyticsRouter } from "./routes/analyticsRoutes.js";
import { integrationsRouter } from "./routes/integrationsRoutes.js";
import { getDataFilePath } from "./utils/store.js";
import { startAutomationWorker } from "./services/automationWorker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasBuiltFrontend = () => fs.existsSync(frontendIndexPath);

const app = express();

app.use(cors());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer?.length ? buffer.toString("utf8") : "";
    }
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    dataFile: getDataFilePath(),
    environment: env.nodeEnv,
    authRequired: Boolean(env.appPassword)
  });
});

app.use("/api", requireApiAuth);

app.use("/api/conversations", conversationsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/automation", automationRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/integrations", integrationsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

if (hasBuiltFrontend()) {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res) => {
    res.sendFile(frontendIndexPath);
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).send("Backend is running. Build frontend to serve UI from this domain.");
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
  startAutomationWorker();
});
