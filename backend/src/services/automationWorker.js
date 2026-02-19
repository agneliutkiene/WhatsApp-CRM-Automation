import { processFollowUpReminders } from "./crmService.js";

let timer = null;

export const startAutomationWorker = () => {
  if (timer) {
    return;
  }

  const run = async () => {
    try {
      await processFollowUpReminders();
    } catch (error) {
      console.error("[automation-worker] failed:", error.message);
    }
  };

  run();
  timer = setInterval(run, 60 * 1000);
};
