import { createId } from "../utils/id.js";
import { getDb, getOrCreateWorkspace, saveDb } from "../utils/store.js";
import { nowIso, isWithinBusinessHours } from "../utils/time.js";
import { sendWhatsAppTextMessage } from "./whatsappService.js";

const normalizePhone = (phone) => String(phone || "").replace(/\s+/g, "").trim();
const AUTOMATION_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CONVERSATION_STATES = new Set(["NEW", "FOLLOW_UP", "CLOSED"]);

const sortConversations = (conversations) =>
  [...conversations].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

const getTemplateById = (workspace, templateId) =>
  workspace.templates.find((template) => template.id === templateId);

const upsertConversationByPhone = (workspace, { phone, name = "Unknown", source = "WHATSAPP" }) => {
  const normalized = normalizePhone(phone);
  let conversation = workspace.conversations.find((entry) => normalizePhone(entry.phone) === normalized);

  if (!conversation) {
    const now = nowIso();
    conversation = {
      id: createId("conv"),
      name,
      phone: normalized,
      state: "NEW",
      source,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      lastMessageText: "",
      followUpAt: null,
      followUpReminderSentAt: null,
      notes: []
    };

    workspace.conversations.push(conversation);
  } else if (name && conversation.name === "Unknown") {
    conversation.name = name;
  }

  return conversation;
};

const appendMessage = (
  workspace,
  { conversationId, direction, text, source, templateId = null, status = "RECEIVED" }
) => {
  const now = nowIso();
  const message = {
    id: createId("msg"),
    conversationId,
    direction,
    text,
    createdAt: now,
    channel: "WHATSAPP",
    source,
    status,
    templateId
  };

  workspace.messages.push(message);

  const conversation = workspace.conversations.find((entry) => entry.id === conversationId);
  if (conversation) {
    conversation.lastMessageAt = now;
    conversation.lastMessageText = text;
    conversation.updatedAt = now;
  }

  return message;
};

const sendAutomationMessages = async ({ workspace, conversation, actions, userId }) => {
  const sentMessages = [];

  for (const action of actions) {
    const outgoing = appendMessage(workspace, {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      text: action.template.body,
      source: "AUTOMATION",
      templateId: action.template.id,
      status: "PENDING"
    });

    try {
      const provider = await sendWhatsAppTextMessage({
        userId,
        to: conversation.phone,
        text: action.template.body
      });
      outgoing.status = provider.status;
      outgoing.externalId = provider.externalId;
    } catch (error) {
      outgoing.status = "FAILED";
      outgoing.error = error.message;
    }

    sentMessages.push(outgoing);
  }

  return sentMessages;
};

const maybeCreateAutomaticReply = async ({ workspace, conversation, userId }) => {
  const automation = workspace.automation;
  if (!automation) {
    return [];
  }

  const outboundCount = workspace.messages.filter(
    (message) => message.conversationId === conversation.id && message.direction === "OUTBOUND"
  ).length;

  const actions = [];

  const inBusinessHours = isWithinBusinessHours({
    timezone: automation.timezone,
    start: automation.businessHoursStart,
    end: automation.businessHoursEnd
  });

  if (!inBusinessHours && automation.businessHoursReplyEnabled) {
    const template = getTemplateById(workspace, automation.afterHoursTemplateId);
    if (template) {
      actions.push({ template });
      return sendAutomationMessages({ workspace, conversation, actions, userId });
    }
  }

  if (automation.autoReplyOnFirstInquiry && outboundCount === 0) {
    const template = getTemplateById(workspace, automation.firstInquiryTemplateId);
    if (template) {
      actions.push({ template });
    }
  }

  return sendAutomationMessages({ workspace, conversation, actions, userId });
};

const isValidTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch (_error) {
    return false;
  }
};

const normalizeAutomationConfig = (current = {}, next = {}) => ({
  ...current,
  ...next,
  autoReplyOnFirstInquiry: Boolean(next.autoReplyOnFirstInquiry ?? current.autoReplyOnFirstInquiry),
  businessHoursReplyEnabled: Boolean(next.businessHoursReplyEnabled ?? current.businessHoursReplyEnabled),
  followUpReminderEnabled: Boolean(next.followUpReminderEnabled ?? current.followUpReminderEnabled),
  firstInquiryTemplateId: String(next.firstInquiryTemplateId ?? current.firstInquiryTemplateId ?? "").trim(),
  afterHoursTemplateId: String(next.afterHoursTemplateId ?? current.afterHoursTemplateId ?? "").trim(),
  followUpReminderTemplateId: String(next.followUpReminderTemplateId ?? current.followUpReminderTemplateId ?? "").trim(),
  timezone: String(next.timezone ?? current.timezone ?? "").trim(),
  businessHoursStart: String(next.businessHoursStart ?? current.businessHoursStart ?? "").trim(),
  businessHoursEnd: String(next.businessHoursEnd ?? current.businessHoursEnd ?? "").trim()
});

const getAutomationValidation = ({ config, templateIds }) => {
  const errors = [];
  const warnings = [];

  if (!config.timezone || !isValidTimezone(config.timezone)) {
    errors.push("Timezone is invalid. Use a valid IANA timezone (example: Asia/Kolkata).");
  }

  if (!AUTOMATION_TIME_REGEX.test(config.businessHoursStart)) {
    errors.push("Business start time must be in HH:MM format.");
  }

  if (!AUTOMATION_TIME_REGEX.test(config.businessHoursEnd)) {
    errors.push("Business end time must be in HH:MM format.");
  }

  if (config.businessHoursStart === config.businessHoursEnd) {
    errors.push("Business start and end time cannot be the same.");
  }

  if (config.autoReplyOnFirstInquiry && !templateIds.has(config.firstInquiryTemplateId)) {
    errors.push("Auto-reply on first inquiry is enabled, but the template is missing.");
  }

  if (config.businessHoursReplyEnabled && !templateIds.has(config.afterHoursTemplateId)) {
    errors.push("After-hours auto-reply is enabled, but the template is missing.");
  }

  if (config.followUpReminderEnabled && !templateIds.has(config.followUpReminderTemplateId)) {
    errors.push("Follow-up reminders are enabled, but the template is missing.");
  }

  if (!config.autoReplyOnFirstInquiry && !config.businessHoursReplyEnabled && !config.followUpReminderEnabled) {
    warnings.push("All automation toggles are OFF. The system will run fully manual.");
  }

  const enabledCount = [
    config.autoReplyOnFirstInquiry,
    config.businessHoursReplyEnabled,
    config.followUpReminderEnabled
  ].filter(Boolean).length;

  if (enabledCount >= 3) {
    warnings.push("All automation rules are ON. Keep templates concise to avoid message fatigue.");
  }

  return { errors, warnings };
};

export const getConversations = ({ userId, state, search } = {}) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  let conversations = sortConversations(workspace.conversations);

  if (state && state !== "ALL") {
    conversations = conversations.filter((conversation) => conversation.state === state);
  }

  if (search) {
    const term = search.toLowerCase();
    conversations = conversations.filter(
      (conversation) =>
        conversation.name.toLowerCase().includes(term) ||
        conversation.phone.toLowerCase().includes(term) ||
        conversation.lastMessageText.toLowerCase().includes(term)
    );
  }

  return conversations;
};

export const getConversationDetails = ({ userId, conversationId }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = workspace.conversations.find((entry) => entry.id === conversationId);
  if (!conversation) {
    return null;
  }

  const messages = workspace.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    ...conversation,
    messages
  };
};

export const receiveInboundMessage = async ({ userId, phone, name, text, source = "WHATSAPP_WEBHOOK" }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = upsertConversationByPhone(workspace, {
    phone,
    name,
    source
  });

  const inbound = appendMessage(workspace, {
    conversationId: conversation.id,
    direction: "INBOUND",
    text,
    source,
    status: "RECEIVED"
  });

  const automaticReplies = await maybeCreateAutomaticReply({ workspace, conversation, userId });

  saveDb(db);

  return {
    conversation,
    inbound,
    automaticReplies
  };
};

export const sendManualMessage = async ({ userId, conversationId, text, templateId = null }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = workspace.conversations.find((entry) => entry.id === conversationId);

  if (!conversation) {
    return null;
  }

  const message = appendMessage(workspace, {
    conversationId,
    direction: "OUTBOUND",
    text,
    source: "DASHBOARD",
    templateId,
    status: "PENDING"
  });

  try {
    const provider = await sendWhatsAppTextMessage({
      userId,
      to: conversation.phone,
      text
    });
    message.status = provider.status;
    message.externalId = provider.externalId;
  } catch (error) {
    message.status = "FAILED";
    message.error = error.message;
  }

  saveDb(db);
  return message;
};

export const updateConversation = ({ userId, conversationId, state, followUpAt }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = workspace.conversations.find((entry) => entry.id === conversationId);

  if (!conversation) {
    return null;
  }

  if (state) {
    if (!CONVERSATION_STATES.has(state)) {
      const error = new Error("Invalid conversation state.");
      error.statusCode = 400;
      throw error;
    }
    conversation.state = state;
  }

  if (followUpAt !== undefined) {
    if (followUpAt !== null && followUpAt !== "" && Number.isNaN(new Date(followUpAt).getTime())) {
      const error = new Error("followUpAt must be a valid ISO datetime.");
      error.statusCode = 400;
      throw error;
    }
    conversation.followUpAt = followUpAt;
    conversation.followUpReminderSentAt = null;
  }

  conversation.updatedAt = nowIso();
  saveDb(db);
  return conversation;
};

export const addConversationNote = ({ userId, conversationId, text }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = workspace.conversations.find((entry) => entry.id === conversationId);

  if (!conversation) {
    return null;
  }

  const note = {
    id: createId("note"),
    text,
    createdAt: nowIso()
  };

  conversation.notes.push(note);
  conversation.updatedAt = nowIso();

  saveDb(db);
  return note;
};

export const createOrUpdateTemplate = ({ userId, id, name, body, category = "CUSTOM" }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  let template = workspace.templates.find((entry) => entry.id === id);

  if (!template) {
    template = {
      id: id || createId("tpl"),
      name,
      body,
      category,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    workspace.templates.push(template);
  } else {
    template.name = name ?? template.name;
    template.body = body ?? template.body;
    template.category = category ?? template.category;
    template.updatedAt = nowIso();
  }

  saveDb(db);
  return template;
};

export const getTemplates = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  return workspace.templates;
};

export const getAutomationConfig = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  return workspace.automation;
};

export const getAutomationSafetySnapshot = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const templateIds = new Set(workspace.templates.map((template) => template.id));
  const validation = getAutomationValidation({
    config: workspace.automation,
    templateIds
  });

  return {
    warnings: validation.warnings,
    errors: validation.errors,
    enabledFeatures: [
      workspace.automation.autoReplyOnFirstInquiry,
      workspace.automation.businessHoursReplyEnabled,
      workspace.automation.followUpReminderEnabled
    ].filter(Boolean).length,
    followUpsDueNow: workspace.conversations.filter(
      (conversation) =>
        conversation.state === "FOLLOW_UP" &&
        conversation.followUpAt &&
        new Date(conversation.followUpAt).getTime() <= Date.now()
    ).length
  };
};

export const updateAutomationConfig = ({ userId, nextConfig }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const templateIds = new Set(workspace.templates.map((template) => template.id));
  const mergedConfig = normalizeAutomationConfig(workspace.automation, nextConfig);
  const validation = getAutomationValidation({
    config: mergedConfig,
    templateIds
  });

  if (validation.errors.length > 0) {
    const error = new Error(validation.errors[0]);
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  workspace.automation = mergedConfig;
  saveDb(db);
  return {
    config: workspace.automation,
    warnings: validation.warnings
  };
};

export const getPendingFollowUps = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const now = Date.now();

  return workspace.conversations
    .filter((conversation) => conversation.followUpAt && new Date(conversation.followUpAt).getTime() <= now)
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
};

export const getAnalyticsSnapshot = (userId) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const newInquiriesToday = workspace.messages.filter(
    (message) => message.direction === "INBOUND" && message.createdAt >= dayStart
  ).length;

  const pendingFollowUps = workspace.conversations.filter(
    (conversation) => conversation.state === "FOLLOW_UP" && conversation.followUpAt
  ).length;

  const closedConversations = workspace.conversations.filter((conversation) => conversation.state === "CLOSED").length;

  return {
    newInquiriesToday,
    pendingFollowUps,
    closedConversations,
    totalConversations: workspace.conversations.length
  };
};

export const processFollowUpReminders = async () => {
  const db = getDb();
  const now = Date.now();
  const reminders = [];
  const userIds = db.users.map((user) => user.id);

  for (const userId of userIds) {
    const workspace = getOrCreateWorkspace(db, userId);

    if (!workspace.automation.followUpReminderEnabled) {
      continue;
    }

    const template = getTemplateById(workspace, workspace.automation.followUpReminderTemplateId);
    if (!template) {
      continue;
    }

    for (const conversation of workspace.conversations) {
      if (conversation.state !== "FOLLOW_UP") {
        continue;
      }

      if (!conversation.followUpAt) {
        continue;
      }

      const due = new Date(conversation.followUpAt).getTime() <= now;
      if (!due || conversation.followUpReminderSentAt) {
        continue;
      }

      const message = appendMessage(workspace, {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        text: template.body,
        source: "FOLLOW_UP_AUTOMATION",
        templateId: template.id,
        status: "PENDING"
      });

      try {
        const provider = await sendWhatsAppTextMessage({
          userId,
          to: conversation.phone,
          text: template.body
        });
        message.status = provider.status;
        message.externalId = provider.externalId;
      } catch (error) {
        message.status = "FAILED";
        message.error = error.message;
      }

      conversation.followUpReminderSentAt = nowIso();
      conversation.updatedAt = nowIso();
      reminders.push({
        userId,
        conversationId: conversation.id,
        messageId: message.id
      });
    }
  }

  if (reminders.length > 0) {
    saveDb(db);
  }

  return reminders;
};

export const ingestWordPressLead = async ({ userId, name, phone, message, sourceUrl }) => {
  return receiveInboundMessage({
    userId,
    phone,
    name,
    text: `Website lead from ${sourceUrl || "unknown source"}: ${message}`,
    source: "WORDPRESS_FORM"
  });
};

export const sendSetupTestMessage = async ({ userId, phone, text }) => {
  const db = getDb();
  const workspace = getOrCreateWorkspace(db, userId);
  const conversation = upsertConversationByPhone(workspace, {
    phone,
    name: "WhatsApp Setup Test",
    source: "SETUP_TEST"
  });

  const message = appendMessage(workspace, {
    conversationId: conversation.id,
    direction: "OUTBOUND",
    text,
    source: "SETUP_TEST",
    status: "PENDING"
  });

  try {
    const provider = await sendWhatsAppTextMessage({
      userId,
      to: conversation.phone,
      text
    });
    message.status = provider.status;
    message.externalId = provider.externalId;
  } catch (error) {
    message.status = "FAILED";
    message.error = error.message;
  }

  saveDb(db);
  return {
    conversation,
    message
  };
};
