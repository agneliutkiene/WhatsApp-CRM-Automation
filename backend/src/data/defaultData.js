const now = new Date().toISOString();

export const defaultTemplates = [
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

export const defaultData = {
  conversations: [
    {
      id: "conv_demo_1",
      name: "Aarav Mehta",
      phone: "+919812345678",
      state: "NEW",
      source: "WHATSAPP",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      lastMessageText: "Hi, I need pricing details for website setup.",
      followUpAt: null,
      followUpReminderSentAt: null,
      notes: []
    },
    {
      id: "conv_demo_2",
      name: "Priya Rao",
      phone: "+919711112222",
      state: "FOLLOW_UP",
      source: "WORDPRESS_FORM",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      lastMessageText: "Can we schedule a demo tomorrow?",
      followUpAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      followUpReminderSentAt: null,
      notes: [
        {
          id: "note_demo_1",
          text: "Interested in monthly plan, asked for callback.",
          createdAt: now
        }
      ]
    }
  ],
  messages: [
    {
      id: "msg_demo_1",
      conversationId: "conv_demo_1",
      direction: "INBOUND",
      text: "Hi, I need pricing details for website setup.",
      createdAt: now,
      channel: "WHATSAPP",
      source: "WHATSAPP_WEBHOOK",
      status: "RECEIVED",
      templateId: null
    },
    {
      id: "msg_demo_2",
      conversationId: "conv_demo_2",
      direction: "INBOUND",
      text: "Can we schedule a demo tomorrow?",
      createdAt: now,
      channel: "WHATSAPP",
      source: "WORDPRESS_FORM",
      status: "RECEIVED",
      templateId: null
    }
  ],
  templates: defaultTemplates,
  whatsappConfig: {
    businessPhone: "",
    phoneNumberId: "",
    accessToken: "",
    verifyToken: ""
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
};
