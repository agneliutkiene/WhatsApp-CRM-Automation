import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { conversationsRouter } from "./routes/conversationsRoutes.js";
import { templatesRouter } from "./routes/templatesRoutes.js";
import { automationRouter } from "./routes/automationRoutes.js";
import { analyticsRouter } from "./routes/analyticsRoutes.js";
import { integrationsRouter } from "./routes/integrationsRoutes.js";
import { getDataFilePath } from "./utils/store.js";
import { startAutomationWorker } from "./services/automationWorker.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    dataFile: getDataFilePath(),
    environment: env.nodeEnv
  });
});

app.use("/api/conversations", conversationsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/automation", automationRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/integrations", integrationsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
  startAutomationWorker();
});
