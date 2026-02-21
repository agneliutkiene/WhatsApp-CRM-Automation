const nowIso = () => new Date().toISOString();

export const createDefaultTemplates = () => {
  const now = nowIso();
  return [
    {
      id: "tpl_first_inquiry",
      name: "First Inquiry Reply",
      body: "Thanks for reaching out. We received your message and will reply shortly.",
      category: "AUTO_REPLY",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_after_hours",
      name: "After Hours Reply",
      body: "Thanks for your message. We are offline now, but we will respond during business hours.",
      category: "AUTO_REPLY",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "tpl_follow_up",
      name: "Follow-up Reminder",
      body: "Quick follow-up on your request. Let us know if you need any help.",
      category: "FOLLOW_UP",
      createdAt: now,
      updatedAt: now
    }
  ];
};

export const createWorkspaceSeed = () => ({
  conversations: [],
  messages: [],
  templates: createDefaultTemplates(),
  whatsappConfig: {
    businessPhone: "",
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    webhookConfirmedAt: null,
    lastTestSentAt: null
  },
  automation: {
    autoReplyOnFirstInquiry: true,
    firstInquiryTemplateId: "tpl_first_inquiry",
    businessHoursReplyEnabled: true,
    afterHoursTemplateId: "tpl_after_hours",
    followUpReminderEnabled: true,
    followUpReminderTemplateId: "tpl_follow_up",
    timezone: "Asia/Kolkata",
    businessHoursStart: "09:00",
    businessHoursEnd: "19:00"
  },
  logs: []
});

export const defaultData = {
  meta: {
    schemaVersion: 2,
    initializedAt: nowIso()
  },
  users: [],
  authSessions: [],
  workspaces: {}
};
