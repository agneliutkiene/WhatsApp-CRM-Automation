<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api, apiAuth } from "./api";

const FOLLOW_UP_YEAR = 2026;
const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const CALENDAR_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const VALID_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ONBOARDING_STORAGE_KEY = "wa_crm_onboarding_v1";

const loading = ref(false);
const error = ref("");
const success = ref("");
const showWhatsAppModal = ref(false);
const whatsappSaving = ref(false);
const whatsappConnected = ref(false);

const authRequired = ref(false);
const showAuthModal = ref(false);
const authSaving = ref(false);
const authPasswordInput = ref(apiAuth.getPassword());

const currentView = ref("main");
const mainAppUrl = ref("/");
const crmAppUrl = ref("?view=crm");

const whatsappConfig = reactive({
  businessPhone: "",
  phoneNumberId: "",
  accessToken: "",
  verifyToken: ""
});

const analytics = ref({
  newInquiriesToday: 0,
  pendingFollowUps: 0,
  closedConversations: 0,
  totalConversations: 0
});

const filters = reactive({
  state: "ALL",
  search: ""
});
const needsAttentionOnly = ref(false);
const crmFilters = reactive({
  source: "ALL",
  search: ""
});

const conversations = ref([]);
const crmLeads = ref([]);
const selectedConversationId = ref("");
const selectedConversation = ref(null);
const highlightedConversationId = ref("");

const noteInput = ref("");
const messageInput = ref("");
const followUpDate = ref("");
const followUpTime = ref("09:00");
const showFollowUpCalendar = ref(false);
const showFollowUpTimeDropdown = ref(false);
const showAutomationStartDropdown = ref(false);
const showAutomationEndDropdown = ref(false);
const calendarMonth = ref(0);

const templates = ref([]);
const newTemplate = reactive({
  name: "",
  body: "",
  category: "CUSTOM"
});

const automation = reactive({
  autoReplyOnFirstInquiry: true,
  firstInquiryTemplateId: "",
  businessHoursReplyEnabled: true,
  afterHoursTemplateId: "",
  followUpReminderEnabled: true,
  followUpReminderTemplateId: "",
  timezone: "Asia/Kolkata",
  businessHoursStart: "09:00",
  businessHoursEnd: "19:00"
});

const automationWarnings = ref([]);
const automationSafety = reactive({
  warnings: [],
  errors: [],
  enabledFeatures: 0,
  followUpsDueNow: 0
});

const wordpressLead = reactive({
  name: "",
  phone: "",
  message: "",
  sourceUrl: "https://example.com/contact"
});
const onboardingState = reactive({
  automationSaved: false,
  leadAdded: false
});

const states = ["ALL", "NEW", "FOLLOW_UP", "CLOSED"];
const isCrmView = computed(() => currentView.value === "crm");
const onboardingSteps = computed(() => [
  {
    id: "connect",
    title: "Connect WhatsApp API",
    done: whatsappConnected.value,
    hint: "Add phone number ID, access token, and verify token from Meta API setup.",
    cta: "Connect now",
    action: openWhatsAppModal
  },
  {
    id: "automation",
    title: "Save automation rules",
    done: onboardingState.automationSaved,
    hint: "Choose templates and business hours, then click Save automation.",
    cta: "Open automation",
    action: () => scrollToSection("automations")
  },
  {
    id: "lead",
    title: "Push first lead to CRM",
    done: onboardingState.leadAdded,
    hint: "Open CRM window and push one lead from Lead -> WhatsApp CRM form.",
    cta: "Open CRM",
    action: openCrmWindow
  }
]);
const onboardingCompletedCount = computed(() => onboardingSteps.value.filter((step) => step.done).length);
const onboardingProgressPercent = computed(() =>
  Math.round((onboardingCompletedCount.value / onboardingSteps.value.length) * 100)
);
const onboardingComplete = computed(() => onboardingCompletedCount.value >= onboardingSteps.value.length);

const selectedMessages = computed(() => selectedConversation.value?.messages || []);
const selectedNotes = computed(() => selectedConversation.value?.notes || []);
const canGoPreviousMonth = computed(() => calendarMonth.value > 0);
const canGoNextMonth = computed(() => calendarMonth.value < 11);
const crmSummary = computed(() => {
  return crmLeads.value.reduce(
    (summary, lead) => {
      summary.total += 1;
      if (lead.state === "NEW") {
        summary.new += 1;
      } else if (lead.state === "FOLLOW_UP") {
        summary.followUp += 1;
      } else if (lead.state === "CLOSED") {
        summary.closed += 1;
      }
      if (lead.source === "WORDPRESS_FORM") {
        summary.wordpress += 1;
      }
      return summary;
    },
    {
      total: 0,
      new: 0,
      followUp: 0,
      closed: 0,
      wordpress: 0
    }
  );
});
const filteredCrmLeads = computed(() => {
  const source = crmFilters.source;
  const term = crmFilters.search.trim().toLowerCase();

  return crmLeads.value.filter((lead) => {
    const sourceMatch = source === "ALL" ? true : lead.source === source;
    if (!sourceMatch) {
      return false;
    }

    if (!term) {
      return true;
    }

    return (
      String(lead.name || "")
        .toLowerCase()
        .includes(term) ||
      String(lead.phone || "")
        .toLowerCase()
        .includes(term) ||
      String(lead.lastMessageText || "")
        .toLowerCase()
        .includes(term)
    );
  });
});
const visibleConversations = computed(() => {
  if (!needsAttentionOnly.value) {
    return conversations.value;
  }
  return conversations.value.filter((entry) => entry.state !== "CLOSED");
});
const automationClientErrors = computed(() => {
  const errorsList = [];

  if (!automation.timezone.trim()) {
    errorsList.push("Timezone is required.");
  }

  if (!VALID_TIME_REGEX.test(automation.businessHoursStart)) {
    errorsList.push("Start time must use HH:MM format.");
  }

  if (!VALID_TIME_REGEX.test(automation.businessHoursEnd)) {
    errorsList.push("End time must use HH:MM format.");
  }

  if (automation.businessHoursStart === automation.businessHoursEnd) {
    errorsList.push("Start and end time cannot be identical.");
  }

  if (automation.autoReplyOnFirstInquiry && !automation.firstInquiryTemplateId) {
    errorsList.push("Select a first inquiry template.");
  }

  if (automation.businessHoursReplyEnabled && !automation.afterHoursTemplateId) {
    errorsList.push("Select an after-hours template.");
  }

  if (automation.followUpReminderEnabled && !automation.followUpReminderTemplateId) {
    errorsList.push("Select a follow-up template.");
  }

  return errorsList;
});
const followUpTimeOptions = computed(() =>
  Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`)
);
const automationTimeOptions = computed(() =>
  Array.from({ length: 48 }, (_, slot) => {
    const hour = String(Math.floor(slot / 2)).padStart(2, "0");
    const minute = slot % 2 === 0 ? "00" : "30";
    return `${hour}:${minute}`;
  })
);
const calendarDays = computed(() => {
  const firstDay = new Date(FOLLOW_UP_YEAR, calendarMonth.value, 1).getDay();
  const daysInMonth = new Date(FOLLOW_UP_YEAR, calendarMonth.value + 1, 0).getDate();
  const grid = [];

  for (let i = 0; i < firstDay; i += 1) {
    grid.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(day);
  }

  while (grid.length % 7 !== 0) {
    grid.push(null);
  }

  return grid;
});

const applyWhatsAppConfig = (data = {}) => {
  whatsappConfig.businessPhone = data.businessPhone || "";
  whatsappConfig.phoneNumberId = data.phoneNumberId || "";
  whatsappConfig.verifyToken = data.verifyToken || "";
  whatsappConfig.accessToken = "";
  whatsappConnected.value = Boolean(data.isConnected);
};

const applyAutomationSafety = (data = {}) => {
  automationSafety.warnings = data.warnings || [];
  automationSafety.errors = data.errors || [];
  automationSafety.enabledFeatures = data.enabledFeatures || 0;
  automationSafety.followUpsDueNow = data.followUpsDueNow || 0;
};

const setError = (err) => {
  if (!err) {
    return;
  }

  if (err.code === "AUTH_REQUIRED") {
    showAuthModal.value = true;
    error.value = "This dashboard is locked. Enter the API password to continue.";
    return;
  }

  const details = Array.isArray(err.details) && err.details.length > 0 ? ` ${err.details.join(" ")}` : "";
  error.value = `${err.message || "Request failed"}${details}`;
};

const ensureSelectedConversation = () => {
  const targetList = visibleConversations.value.length > 0 ? visibleConversations.value : conversations.value;
  if (!targetList.find((entry) => entry.id === selectedConversationId.value)) {
    selectedConversationId.value = targetList[0]?.id || "";
  }
};

const buildConversationQuery = () => {
  const params = new URLSearchParams();
  if (filters.state && filters.state !== "ALL") {
    params.set("state", filters.state);
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
};

const parseIsoToFollowUpFields = (value) => {
  if (!value) {
    return {
      date: "",
      time: "09:00"
    };
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16)
  };
};

const combineFollowUpToIso = (dateValue, timeValue) => {
  if (!dateValue) {
    return null;
  }

  const safeTime = timeValue || "09:00";
  return new Date(`${dateValue}T${safeTime}:00`).toISOString();
};

const formatFollowUpDisplay = (dateValue, timeValue) => {
  if (!dateValue) {
    return "Select a date in 2026";
  }

  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}${timeValue ? `, ${timeValue}` : ""}`;
};

const openFollowUpCalendar = () => {
  showFollowUpTimeDropdown.value = false;
  showAutomationStartDropdown.value = false;
  showAutomationEndDropdown.value = false;
  const selectedDate = followUpDate.value ? new Date(`${followUpDate.value}T00:00:00`) : null;
  if (selectedDate && selectedDate.getFullYear() === FOLLOW_UP_YEAR) {
    calendarMonth.value = selectedDate.getMonth();
  } else {
    calendarMonth.value = 0;
  }
  showFollowUpCalendar.value = true;
};

const closeFollowUpCalendar = () => {
  showFollowUpCalendar.value = false;
};

const toggleFollowUpTimeDropdown = () => {
  showFollowUpCalendar.value = false;
  showAutomationStartDropdown.value = false;
  showAutomationEndDropdown.value = false;
  showFollowUpTimeDropdown.value = !showFollowUpTimeDropdown.value;
};

const closeFollowUpTimeDropdown = () => {
  showFollowUpTimeDropdown.value = false;
};

const closeAutomationTimeDropdowns = () => {
  showAutomationStartDropdown.value = false;
  showAutomationEndDropdown.value = false;
};

const closeFollowUpPickers = () => {
  closeFollowUpCalendar();
  closeFollowUpTimeDropdown();
  closeAutomationTimeDropdowns();
};

const goToPreviousMonth = () => {
  if (calendarMonth.value > 0) {
    calendarMonth.value -= 1;
  }
};

const goToNextMonth = () => {
  if (calendarMonth.value < 11) {
    calendarMonth.value += 1;
  }
};

const setCalendarMonthFromSelect = (event) => {
  const nextMonth = Number(event.target.value);
  if (Number.isInteger(nextMonth) && nextMonth >= 0 && nextMonth <= 11) {
    calendarMonth.value = nextMonth;
  }
};

const calendarDateValue = (day) =>
  `${FOLLOW_UP_YEAR}-${String(calendarMonth.value + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const isSelectedCalendarDay = (day) => {
  if (!day) {
    return false;
  }

  return followUpDate.value === calendarDateValue(day);
};

const selectCalendarDay = (day) => {
  if (!day) {
    return;
  }

  followUpDate.value = calendarDateValue(day);
  closeFollowUpCalendar();
};

const selectFollowUpTime = (timeOption) => {
  followUpTime.value = timeOption;
  closeFollowUpTimeDropdown();
};

const isSelectedFollowUpTime = (timeOption) => followUpTime.value === timeOption;

const toggleAutomationStartDropdown = () => {
  showFollowUpCalendar.value = false;
  showFollowUpTimeDropdown.value = false;
  showAutomationEndDropdown.value = false;
  showAutomationStartDropdown.value = !showAutomationStartDropdown.value;
};

const toggleAutomationEndDropdown = () => {
  showFollowUpCalendar.value = false;
  showFollowUpTimeDropdown.value = false;
  showAutomationStartDropdown.value = false;
  showAutomationEndDropdown.value = !showAutomationEndDropdown.value;
};

const selectAutomationStartTime = (timeOption) => {
  automation.businessHoursStart = timeOption;
  showAutomationStartDropdown.value = false;
};

const selectAutomationEndTime = (timeOption) => {
  automation.businessHoursEnd = timeOption;
  showAutomationEndDropdown.value = false;
};

const isSelectedAutomationStartTime = (timeOption) => automation.businessHoursStart === timeOption;
const isSelectedAutomationEndTime = (timeOption) => automation.businessHoursEnd === timeOption;

const statusChipClass = (status) => {
  if (status === "SENT" || status === "RECEIVED") {
    return "ok";
  }
  if (status === "FAILED") {
    return "error";
  }
  if (status === "PENDING") {
    return "pending";
  }
  return "neutral";
};

const showSuccess = (message) => {
  success.value = message;
  setTimeout(() => {
    if (success.value === message) {
      success.value = "";
    }
  }, 3200);
};

const jumpToInbox = () => {
  scrollToSection("inbox");
};

const jumpToCrm = () => {
  scrollToSection("crm");
};

const clearHash = () => {
  if (typeof window === "undefined") {
    return;
  }
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", cleanUrl);
};

const scrollToSection = (sectionId) => {
  if (typeof window === "undefined") {
    return;
  }
  const target = document.getElementById(sectionId);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  clearHash();
};

const scrollToTop = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  clearHash();
};

const initializeView = () => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  currentView.value = url.searchParams.get("view") === "crm" ? "crm" : "main";
  mainAppUrl.value = `${url.origin}${url.pathname}`;
  crmAppUrl.value = `${url.origin}${url.pathname}?view=crm`;
};

const openCrmWindow = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.open(crmAppUrl.value, "_blank", "noopener,noreferrer");
};

const formatLeadSource = (source) => {
  if (source === "WORDPRESS_FORM") {
    return "Website";
  }
  if (source === "WHATSAPP_WEBHOOK" || source === "WHATSAPP") {
    return "WhatsApp";
  }
  if (source === "MANUAL_TEST" || source === "SETUP_TEST") {
    return "Manual";
  }
  return source || "Unknown";
};

const hydrateOnboardingState = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    onboardingState.automationSaved = Boolean(parsed?.automationSaved);
    onboardingState.leadAdded = Boolean(parsed?.leadAdded);
  } catch (err) {
    // ignore corrupted local onboarding state
  }
};

const persistOnboardingState = () => {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    automationSaved: onboardingState.automationSaved,
    leadAdded: onboardingState.leadAdded
  };
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(payload));
};

const applySuggestedCredentials = () => {
  if (!whatsappConfig.verifyToken.trim()) {
    whatsappConfig.verifyToken = "whatsapp-crm-verify-2026";
  }
  if (!whatsappConfig.businessPhone.trim()) {
    whatsappConfig.businessPhone = "+919876543210";
  }
  showSuccess("Suggested credential examples applied.");
};

const loadConversations = async () => {
  const data = await api.getConversations(buildConversationQuery());
  conversations.value = data;
  ensureSelectedConversation();
};

const loadCrmLeads = async () => {
  crmLeads.value = await api.getConversations();
};

const loadSelectedConversation = async () => {
  if (!selectedConversationId.value) {
    selectedConversation.value = null;
    return;
  }

  const data = await api.getConversation(selectedConversationId.value);
  selectedConversation.value = data;
  const parsedFollowUp = parseIsoToFollowUpFields(data.followUpAt);
  followUpDate.value = parsedFollowUp.date;
  followUpTime.value = parsedFollowUp.time;
};

const refreshDashboard = async () => {
  loading.value = true;
  error.value = "";

  try {
    const [nextAnalytics, nextTemplates, nextAutomation, nextWhatsAppConfig, nextAutomationSafety] = await Promise.all([
      api.getAnalytics(),
      api.getTemplates(),
      api.getAutomation(),
      api.getWhatsAppConfig(),
      api.getAutomationSafety()
    ]);

    analytics.value = nextAnalytics;
    templates.value = nextTemplates;
    Object.assign(automation, nextAutomation || {});
    applyWhatsAppConfig(nextWhatsAppConfig || {});
    applyAutomationSafety(nextAutomationSafety || {});
    automationWarnings.value = [...(nextAutomationSafety?.warnings || [])];

    await loadCrmLeads();
    await loadConversations();
    await loadSelectedConversation();
  } catch (err) {
    setError(err);
  } finally {
    loading.value = false;
  }
};

const openWhatsAppModal = async () => {
  try {
    const data = await api.getWhatsAppConfig();
    applyWhatsAppConfig(data || {});
    showWhatsAppModal.value = true;
  } catch (err) {
    setError(err);
  }
};

const closeWhatsAppModal = () => {
  showWhatsAppModal.value = false;
  whatsappConfig.accessToken = "";
};

const saveWhatsAppConfig = async () => {
  whatsappSaving.value = true;
  error.value = "";

  try {
    const payload = {
      businessPhone: whatsappConfig.businessPhone.trim(),
      phoneNumberId: whatsappConfig.phoneNumberId.trim(),
      verifyToken: whatsappConfig.verifyToken.trim()
    };

    if (whatsappConfig.accessToken.trim()) {
      payload.accessToken = whatsappConfig.accessToken.trim();
    }

    const data = await api.updateWhatsAppConfig(payload);
    applyWhatsAppConfig(data || {});
    showWhatsAppModal.value = false;
    showSuccess("WhatsApp credentials saved.");
  } catch (err) {
    setError(err);
  } finally {
    whatsappSaving.value = false;
  }
};

const unlockDashboard = async () => {
  if (!authPasswordInput.value.trim()) {
    error.value = "App password is required.";
    return;
  }

  authSaving.value = true;
  error.value = "";

  try {
    apiAuth.setPassword(authPasswordInput.value.trim());
    await refreshDashboard();
    if (!error.value) {
      showAuthModal.value = false;
      showSuccess("Dashboard unlocked.");
    }
  } catch (err) {
    setError(err);
  } finally {
    authSaving.value = false;
  }
};

const lockDashboard = () => {
  apiAuth.clearPassword();
  authPasswordInput.value = "";
  showAuthModal.value = true;
  error.value = "Dashboard locked. Enter password to continue.";
};

const clearSavedPassword = () => {
  apiAuth.clearPassword();
  authPasswordInput.value = "";
};

const saveConversationMeta = async () => {
  if (!selectedConversation.value) {
    return;
  }

  try {
    await api.updateConversation(selectedConversation.value.id, {
      state: selectedConversation.value.state,
      followUpAt: combineFollowUpToIso(followUpDate.value, followUpTime.value)
    });

    await loadCrmLeads();
    await loadConversations();
    await loadSelectedConversation();
    analytics.value = await api.getAnalytics();
    showSuccess("Conversation state saved.");
  } catch (err) {
    setError(err);
  }
};

const quickSetConversationState = async (conversationId, state) => {
  try {
    await api.updateConversation(conversationId, { state });
    await loadCrmLeads();
    await loadConversations();
    if (selectedConversationId.value === conversationId) {
      await loadSelectedConversation();
    }
    analytics.value = await api.getAnalytics();
    showSuccess(`Conversation moved to ${state}.`);
  } catch (err) {
    setError(err);
  }
};

const focusNextOpenConversation = () => {
  const currentIndex = visibleConversations.value.findIndex((entry) => entry.id === selectedConversationId.value);
  const nextConversation =
    visibleConversations.value[currentIndex + 1] ||
    visibleConversations.value.find((entry) => entry.id !== selectedConversationId.value) ||
    null;

  if (nextConversation) {
    selectedConversationId.value = nextConversation.id;
  }
};

const addNote = async () => {
  if (!selectedConversation.value || !noteInput.value.trim()) {
    return;
  }

  try {
    await api.addNote(selectedConversation.value.id, noteInput.value.trim());
    noteInput.value = "";
    await loadSelectedConversation();
    showSuccess("Note saved.");
  } catch (err) {
    setError(err);
  }
};

const sendMessage = async () => {
  if (!selectedConversation.value || !messageInput.value.trim()) {
    return;
  }

  try {
    await api.sendMessage(selectedConversation.value.id, {
      text: messageInput.value.trim()
    });

    messageInput.value = "";
    await loadCrmLeads();
    await loadConversations();
    await loadSelectedConversation();
    analytics.value = await api.getAnalytics();
    showSuccess("Message sent.");
  } catch (err) {
    setError(err);
  }
};

const useTemplate = (template) => {
  messageInput.value = template.body;
};

const createTemplate = async () => {
  if (!newTemplate.name.trim() || !newTemplate.body.trim()) {
    return;
  }

  try {
    await api.createTemplate({
      name: newTemplate.name.trim(),
      body: newTemplate.body.trim(),
      category: newTemplate.category
    });

    newTemplate.name = "";
    newTemplate.body = "";
    newTemplate.category = "CUSTOM";
    templates.value = await api.getTemplates();
    showSuccess("Template created.");
  } catch (err) {
    setError(err);
  }
};

const saveAutomation = async () => {
  if (automationClientErrors.value.length > 0) {
    error.value = automationClientErrors.value[0];
    return;
  }

  try {
    const payload = await api.updateAutomation({ ...automation });
    Object.assign(automation, payload.config || {});
    automationWarnings.value = payload.warnings || [];

    const safety = await api.getAutomationSafety();
    applyAutomationSafety(safety || {});
    onboardingState.automationSaved = true;
    persistOnboardingState();
    showSuccess("Automation saved.");
  } catch (err) {
    setError(err);
  }
};

const submitWordPressLead = async () => {
  if (!wordpressLead.phone.trim() || !wordpressLead.message.trim()) {
    return;
  }

  try {
    const data = await api.pushWordPressLead({
      ...wordpressLead
    });

    wordpressLead.name = "";
    wordpressLead.phone = "";
    wordpressLead.message = "";
    onboardingState.leadAdded = true;
    persistOnboardingState();

    const insertedConversationId = data?.conversation?.id || "";

    filters.state = "ALL";
    filters.search = "";
    analytics.value = await api.getAnalytics();
    await loadCrmLeads();
    await loadConversations();

    if (insertedConversationId) {
      selectedConversationId.value = insertedConversationId;
      highlightedConversationId.value = insertedConversationId;
      setTimeout(() => {
        if (highlightedConversationId.value === insertedConversationId) {
          highlightedConversationId.value = "";
        }
      }, 3000);
      await loadSelectedConversation();
      jumpToInbox();
      showSuccess("Lead added to CRM inbox and opened.");
    } else {
      await loadSelectedConversation();
      showSuccess("Lead added to CRM inbox.");
    }
  } catch (err) {
    setError(err);
  }
};

const openLeadFromCrm = async (conversationId) => {
  try {
    selectedConversationId.value = conversationId;
    highlightedConversationId.value = conversationId;
    setTimeout(() => {
      if (highlightedConversationId.value === conversationId) {
        highlightedConversationId.value = "";
      }
    }, 2800);
    jumpToInbox();
    await loadSelectedConversation();
  } catch (err) {
    setError(err);
  }
};

watch(
  () => [filters.state, filters.search],
  async () => {
    try {
      await loadConversations();
      await loadSelectedConversation();
    } catch (err) {
      setError(err);
    }
  }
);

watch(needsAttentionOnly, async () => {
  ensureSelectedConversation();
  await loadSelectedConversation();
});

watch(selectedConversationId, async () => {
  try {
    await loadSelectedConversation();
  } catch (err) {
    setError(err);
  }
});

const initializeDashboard = async () => {
  initializeView();
  hydrateOnboardingState();

  try {
    const health = await api.getHealth();
    authRequired.value = Boolean(health?.authRequired);
    if (authRequired.value && !apiAuth.getPassword()) {
      showAuthModal.value = true;
    }
  } catch (err) {
    setError(err);
  }

  await refreshDashboard();
};

onMounted(initializeDashboard);
</script>
<template>
  <div class="app-shell" id="top">
    <div class="bg-blob"></div>
    <div class="bg-ring"></div>

    <header class="topbar">
      <div class="brand">&lt;/&gt; WhatsAppCRM</div>
      <nav class="top-nav">
        <a v-if="isCrmView" :href="mainAppUrl">Main App</a>
        <button v-else class="nav-link-button" @click="openCrmWindow">CRM</button>
        <button v-if="!isCrmView" class="nav-link-button" @click="scrollToSection('inbox')">Inbox</button>
        <button v-if="!isCrmView" class="nav-link-button" @click="scrollToSection('automations')">Automation</button>
        <button v-if="!isCrmView" class="nav-link-button" @click="scrollToSection('templates')">Templates</button>
        <button v-if="isCrmView" class="nav-link-button" @click="scrollToSection('crm')">CRM Board</button>
        <button v-if="isCrmView" class="nav-link-button" @click="scrollToSection('lead-capture')">Lead Capture</button>
        <button class="nav-link-button" @click="scrollToTop">Top</button>
      </nav>
    </header>

    <header class="hero">
      <div>
        <h1>WhatsApp CRM & Automation</h1>
        <p class="subhead">
          Desktop control layer for WhatsApp Business: inbox, follow-ups, notes, automation, and daily analytics.
        </p>
      </div>
      <div class="hero-actions">
        <div class="connect-stack">
          <button class="connect-whatsapp" @click="openWhatsAppModal">Connect your WhatsApp</button>
          <small class="connection-status" :data-connected="whatsappConnected">
            {{ whatsappConnected ? "WhatsApp connected" : "WhatsApp not connected" }}
          </small>
        </div>
        <button class="refresh" @click="refreshDashboard" :disabled="loading">{{ loading ? "Refreshing..." : "Refresh" }}</button>
        <button v-if="authRequired" class="refresh" @click="lockDashboard">Lock</button>
      </div>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>
    <p v-if="success" class="success-banner">{{ success }}</p>

    <template v-if="!isCrmView">
      <section v-if="!onboardingComplete" class="card setup-card">
        <div class="setup-heading">
          <h3>Onboarding checklist</h3>
          <span class="setup-progress">{{ onboardingCompletedCount }}/{{ onboardingSteps.length }} completed</span>
        </div>
        <div
          class="onboarding-progress"
          role="progressbar"
          :aria-valuenow="onboardingProgressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="onboarding-progress-fill" :style="{ width: `${onboardingProgressPercent}%` }"></span>
        </div>
        <div class="setup-step-grid">
          <article v-for="step in onboardingSteps" :key="step.id" class="setup-step" :data-done="step.done">
            <h4>{{ step.title }}</h4>
            <p class="setup-copy">{{ step.hint }}</p>
            <div class="setup-actions">
              <button :class="{ primary: !step.done }" @click="step.action">
                {{ step.done ? "Review" : step.cta }}
              </button>
              <span class="feature-label" :data-enabled="step.done">
                {{ step.done ? "DONE" : "PENDING" }}
              </span>
            </div>
          </article>
        </div>
      </section>

      <section class="workspace" id="inbox">
      <aside class="inbox-panel">
        <div class="toolbar-row">
          <select v-model="filters.state">
            <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
          </select>
          <input v-model="filters.search" placeholder="Search name, phone, or text" />
        </div>
        <div class="toolbar-subrow">
          <label class="toggle-inline">
            <input type="checkbox" v-model="needsAttentionOnly" />
            Needs action only
          </label>
          <button @click="focusNextOpenConversation">Next</button>
        </div>

        <ul class="conversation-list">
          <li
            v-for="item in visibleConversations"
            :key="item.id"
            :class="{ active: item.id === selectedConversationId, inserted: item.id === highlightedConversationId }"
            @click="selectedConversationId = item.id"
          >
            <div class="line1">
              <strong>{{ item.name }}</strong>
              <span class="pill" :data-state="item.state">{{ item.state }}</span>
            </div>
            <p>{{ item.phone }}</p>
            <p class="dim">{{ item.lastMessageText }}</p>
            <small>{{ formatDate(item.lastMessageAt) }}</small>
            <div class="list-actions">
              <button @click.stop="quickSetConversationState(item.id, 'NEW')">New</button>
              <button @click.stop="quickSetConversationState(item.id, 'FOLLOW_UP')">Follow-up</button>
              <button @click.stop="quickSetConversationState(item.id, 'CLOSED')">Close</button>
            </div>
          </li>
        </ul>
        <p v-if="visibleConversations.length === 0" class="dim">No conversations match the current filter.</p>
      </aside>

      <main class="detail-panel">
        <section class="stats-grid stats-grid-inline">
          <article>
            <h2>{{ analytics.newInquiriesToday }}</h2>
            <p>New inquiries today</p>
          </article>
          <article>
            <h2>{{ analytics.pendingFollowUps }}</h2>
            <p>Pending follow-ups</p>
          </article>
          <article>
            <h2>{{ analytics.closedConversations }}</h2>
            <p>Closed conversations</p>
          </article>
          <article>
            <h2>{{ analytics.totalConversations }}</h2>
            <p>Total conversations</p>
          </article>
        </section>

        <section v-if="selectedConversation" class="card conversation-card">
          <h3>Conversation</h3>
          <div class="conversation-quick-actions">
            <button @click="quickSetConversationState(selectedConversation.id, 'NEW')">Mark NEW</button>
            <button @click="quickSetConversationState(selectedConversation.id, 'FOLLOW_UP')">Mark FOLLOW_UP</button>
            <button @click="quickSetConversationState(selectedConversation.id, 'CLOSED')">Mark CLOSED</button>
            <button class="primary" @click="focusNextOpenConversation">Open next</button>
          </div>
          <div class="meta-grid">
            <label class="meta-field">
              State
              <select v-model="selectedConversation.state">
                <option value="NEW">NEW</option>
                <option value="FOLLOW_UP">FOLLOW_UP</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
            <label class="meta-field">
              Follow-up date
              <div class="followup-field">
                <button type="button" class="date-trigger" @click="openFollowUpCalendar">
                  <span>{{ formatFollowUpDisplay(followUpDate, followUpTime) }}</span>
                  <span class="calendar-icon">📅</span>
                </button>
                <button type="button" class="time-trigger" @click="toggleFollowUpTimeDropdown">
                  <span>{{ followUpTime || "09:00" }}</span>
                  <span class="time-icons">
                    <span class="clock-icon">🕒</span>
                    <span class="time-arrow">⌄</span>
                  </span>
                </button>
                <small class="picker-hint">Click time to open hour list</small>
                <div v-if="showFollowUpTimeDropdown" class="time-popover">
                  <button
                    v-for="timeOption in followUpTimeOptions"
                    :key="timeOption"
                    type="button"
                    class="time-option"
                    :class="{ selected: isSelectedFollowUpTime(timeOption) }"
                    @click="selectFollowUpTime(timeOption)"
                  >
                    {{ timeOption }}
                  </button>
                </div>
                <div v-if="showFollowUpCalendar" class="calendar-popover">
                  <div class="calendar-header">
                    <button type="button" @click="goToPreviousMonth" :disabled="!canGoPreviousMonth">‹</button>
                    <div class="calendar-title">
                      <select class="calendar-month-select" :value="calendarMonth" @change="setCalendarMonthFromSelect">
                        <option v-for="(month, monthIndex) in CALENDAR_MONTHS" :key="month" :value="monthIndex">
                          {{ month }}
                        </option>
                      </select>
                      <span class="calendar-year">{{ FOLLOW_UP_YEAR }}</span>
                    </div>
                    <button type="button" @click="goToNextMonth" :disabled="!canGoNextMonth">›</button>
                  </div>
                  <div class="calendar-weekdays">
                    <span v-for="weekday in CALENDAR_WEEKDAYS" :key="weekday">{{ weekday }}</span>
                  </div>
                  <div class="calendar-grid">
                    <button
                      v-for="(day, dayIndex) in calendarDays"
                      :key="`${calendarMonth}-${dayIndex}`"
                      type="button"
                      class="calendar-day"
                      :class="{ selected: isSelectedCalendarDay(day), empty: !day }"
                      :disabled="!day"
                      @click="selectCalendarDay(day)"
                    >
                      {{ day || "" }}
                    </button>
                  </div>
                </div>
              </div>
            </label>
            <div class="meta-action">
              <button class="primary meta-save-btn" @click="saveConversationMeta">Save state & follow-up</button>
            </div>
          </div>

          <div class="messages">
            <article v-for="message in selectedMessages" :key="message.id" :class="['message', message.direction.toLowerCase()]">
              <header>
                <strong>{{ message.direction }}</strong>
                <small>{{ formatDate(message.createdAt) }}</small>
              </header>
              <p>{{ message.text }}</p>
              <small v-if="message.status" class="status-chip" :data-tone="statusChipClass(message.status)">
                {{ message.status }}
              </small>
            </article>
          </div>

          <div class="composer">
            <textarea
              v-model="messageInput"
              rows="3"
              placeholder="Write a manual message reply..."
            ></textarea>
            <button class="primary" @click="sendMessage">Send message</button>
          </div>

          <div class="template-strip">
            <button v-for="template in templates" :key="template.id" @click="useTemplate(template)">
              {{ template.name }}
            </button>
          </div>
        </section>

        <section v-else class="card">
          <p>Select a conversation from the inbox.</p>
        </section>

        <section class="card">
          <h3>Notes & Memory</h3>
          <div class="notes-list">
            <article v-for="note in selectedNotes" :key="note.id">
              <p>{{ note.text }}</p>
              <small>{{ formatDate(note.createdAt) }}</small>
            </article>
            <p v-if="selectedNotes.length === 0" class="dim">No notes yet.</p>
          </div>
          <div class="inline-form">
            <input v-model="noteInput" placeholder="Add context note for this contact" />
            <button @click="addNote">Add note</button>
          </div>
        </section>
      </main>
      </section>

      <div id="automation"></div>
      <section class="grid-1" id="automations">
      <article class="card automation-card">
        <h3>Automation Settings</h3>
        <div class="automation-toggle-list">
          <label class="automation-toggle-row">
            <input type="checkbox" v-model="automation.autoReplyOnFirstInquiry" />
            <span>Auto-reply on first inquiry</span>
            <span class="feature-label" :data-enabled="automation.autoReplyOnFirstInquiry">
              {{ automation.autoReplyOnFirstInquiry ? "ON" : "OFF" }}
            </span>
          </label>
          <label class="automation-toggle-row">
            <input type="checkbox" v-model="automation.businessHoursReplyEnabled" />
            <span>After-hours auto-reply</span>
            <span class="feature-label" :data-enabled="automation.businessHoursReplyEnabled">
              {{ automation.businessHoursReplyEnabled ? "ON" : "OFF" }}
            </span>
          </label>
          <label class="automation-toggle-row">
            <input type="checkbox" v-model="automation.followUpReminderEnabled" />
            <span>Follow-up reminders</span>
            <span class="feature-label" :data-enabled="automation.followUpReminderEnabled">
              {{ automation.followUpReminderEnabled ? "ON" : "OFF" }}
            </span>
          </label>
        </div>

        <div class="triple">
          <label>
            Timezone
            <input v-model="automation.timezone" placeholder="Asia/Kolkata" />
          </label>
          <label>
            Start
            <div class="automation-time-field">
              <button type="button" class="time-trigger" @click="toggleAutomationStartDropdown">
                <span>{{ automation.businessHoursStart || "09:00" }}</span>
                <span class="time-icons">
                  <span class="clock-icon">🕒</span>
                  <span class="time-arrow">⌄</span>
                </span>
              </button>
              <div v-if="showAutomationStartDropdown" class="time-popover">
                <button
                  v-for="timeOption in automationTimeOptions"
                  :key="`start-${timeOption}`"
                  type="button"
                  class="time-option"
                  :class="{ selected: isSelectedAutomationStartTime(timeOption) }"
                  @click="selectAutomationStartTime(timeOption)"
                >
                  {{ timeOption }}
                </button>
              </div>
            </div>
          </label>
          <label>
            End
            <div class="automation-time-field">
              <button type="button" class="time-trigger" @click="toggleAutomationEndDropdown">
                <span>{{ automation.businessHoursEnd || "19:00" }}</span>
                <span class="time-icons">
                  <span class="clock-icon">🕒</span>
                  <span class="time-arrow">⌄</span>
                </span>
              </button>
              <div v-if="showAutomationEndDropdown" class="time-popover">
                <button
                  v-for="timeOption in automationTimeOptions"
                  :key="`end-${timeOption}`"
                  type="button"
                  class="time-option"
                  :class="{ selected: isSelectedAutomationEndTime(timeOption) }"
                  @click="selectAutomationEndTime(timeOption)"
                >
                  {{ timeOption }}
                </button>
              </div>
            </div>
          </label>
        </div>

        <div class="triple">
          <label>
            First inquiry template
            <select v-model="automation.firstInquiryTemplateId">
              <option v-for="template in templates" :value="template.id" :key="`fi-${template.id}`">{{ template.name }}</option>
            </select>
          </label>
          <label>
            After-hours template
            <select v-model="automation.afterHoursTemplateId">
              <option v-for="template in templates" :value="template.id" :key="`ah-${template.id}`">{{ template.name }}</option>
            </select>
          </label>
          <label>
            Follow-up template
            <select v-model="automation.followUpReminderTemplateId">
              <option v-for="template in templates" :value="template.id" :key="`fu-${template.id}`">{{ template.name }}</option>
            </select>
          </label>
        </div>

        <section class="automation-safety">
          <p>Enabled rules: <strong>{{ automationSafety.enabledFeatures }}</strong></p>
          <p>Follow-ups due now: <strong>{{ automationSafety.followUpsDueNow }}</strong></p>
          <p v-for="issue in automationClientErrors" :key="`client-${issue}`" class="error-mini">{{ issue }}</p>
          <p v-for="issue in automationSafety.errors" :key="`server-error-${issue}`" class="error-mini">{{ issue }}</p>
          <p v-for="warning in automationSafety.warnings" :key="`server-warning-${warning}`" class="warning-mini">
            {{ warning }}
          </p>
          <p v-for="warning in automationWarnings" :key="`warning-${warning}`" class="warning-mini">{{ warning }}</p>
        </section>

        <button class="primary" @click="saveAutomation" :disabled="automationClientErrors.length > 0">Save automation</button>
      </article>
      </section>

      <section class="grid-1" id="templates">
      <article class="card template-manager-card">
        <h3>Template Manager</h3>
        <div class="template-manager-form">
          <div class="inline-form">
            <input v-model="newTemplate.name" placeholder="Template name" />
            <select v-model="newTemplate.category">
              <option value="CUSTOM">CUSTOM</option>
              <option value="AUTO_REPLY">AUTO_REPLY</option>
              <option value="FOLLOW_UP">FOLLOW_UP</option>
            </select>
          </div>
          <textarea v-model="newTemplate.body" rows="3" placeholder="Template text"></textarea>
          <button class="primary" @click="createTemplate">Create template</button>
        </div>

        <ul class="template-list">
          <li v-for="template in templates" :key="template.id">
            <strong>{{ template.name }}</strong>
            <p>{{ template.body }}</p>
            <small>{{ template.category }}</small>
          </li>
        </ul>
      </article>
      </section>
    </template>

    <template v-else>
      <section class="card crm-overview" id="crm">
        <div class="setup-heading">
          <h3>CRM Lead Board</h3>
          <span class="setup-progress">{{ crmSummary.total }} total leads</span>
        </div>
        <div class="crm-stats-grid">
          <article>
            <h4>{{ crmSummary.new }}</h4>
            <p>New</p>
          </article>
          <article>
            <h4>{{ crmSummary.followUp }}</h4>
            <p>Follow-up</p>
          </article>
          <article>
            <h4>{{ crmSummary.closed }}</h4>
            <p>Closed</p>
          </article>
          <article>
            <h4>{{ crmSummary.wordpress }}</h4>
            <p>Website leads</p>
          </article>
        </div>
        <div class="crm-toolbar">
          <select v-model="crmFilters.source">
            <option value="ALL">All sources</option>
            <option value="WORDPRESS_FORM">Website form</option>
            <option value="WHATSAPP_WEBHOOK">WhatsApp webhook</option>
            <option value="WHATSAPP">WhatsApp native</option>
            <option value="MANUAL_TEST">Manual test</option>
            <option value="SETUP_TEST">Setup test</option>
          </select>
          <input v-model="crmFilters.search" placeholder="Search leads by name, phone, or text" />
        </div>
        <div class="crm-list">
          <article v-for="lead in filteredCrmLeads" :key="`crm-${lead.id}`" class="crm-item">
            <div class="crm-item-main">
              <div class="crm-line">
                <strong>{{ lead.name }}</strong>
                <span class="pill" :data-state="lead.state">{{ lead.state }}</span>
              </div>
              <p>{{ lead.phone }}</p>
              <p class="dim">{{ lead.lastMessageText }}</p>
            </div>
            <div class="crm-item-meta">
              <span class="source-chip">{{ formatLeadSource(lead.source) }}</span>
              <small>{{ formatDate(lead.lastMessageAt) }}</small>
              <button @click="openLeadFromCrm(lead.id)">Open in inbox</button>
            </div>
          </article>
          <p v-if="filteredCrmLeads.length === 0" class="dim">No leads match this CRM filter.</p>
        </div>
      </section>

      <section class="grid-1" id="lead-capture">
      <article class="card form-stack">
        <h3>Lead -> WhatsApp CRM</h3>
        <div class="inline-form">
          <input v-model="wordpressLead.name" placeholder="Lead name" />
          <input v-model="wordpressLead.phone" placeholder="Phone (+91...)" />
        </div>
        <textarea v-model="wordpressLead.message" rows="3" placeholder="Lead message"></textarea>
        <input v-model="wordpressLead.sourceUrl" placeholder="Lead source URL" />
        <button class="primary" @click="submitWordPressLead">Push lead</button>
        <p class="card-hint">
          Leads appear in <strong>CRM Lead Board</strong> and Inbox as <strong>NEW</strong> conversations.
          <button type="button" class="link-button" @click="jumpToCrm">Go to CRM</button>
        </p>
      </article>
      </section>
    </template>

    <div
      v-if="showFollowUpCalendar || showFollowUpTimeDropdown || showAutomationStartDropdown || showAutomationEndDropdown"
      class="calendar-overlay"
      @click="closeFollowUpPickers"
    ></div>

    <button type="button" class="scroll-top" @click="scrollToTop">Top</button>

    <div v-if="showWhatsAppModal" class="modal-backdrop" @click.self="closeWhatsAppModal">
      <section class="modal-card">
        <h3>Connect your WhatsApp</h3>
        <p class="dim">
          Add your WhatsApp Business API credentials. This enables real message sending from the dashboard.
        </p>
        <div class="modal-grid">
          <label>
            Business phone number
            <input v-model="whatsappConfig.businessPhone" placeholder="+919876543210" />
            <small class="field-hint">Use full international format, no spaces.</small>
          </label>
          <label>
            Phone number ID
            <input v-model="whatsappConfig.phoneNumberId" placeholder="123456789012345" />
            <small class="field-hint">From Meta Developer -> WhatsApp -> API Setup.</small>
          </label>
          <label>
            Access token
            <input v-model="whatsappConfig.accessToken" type="password" placeholder="Meta access token" />
            <small class="field-hint">Paste temporary/permanent token from Meta.</small>
          </label>
          <label>
            Webhook verify token
            <input v-model="whatsappConfig.verifyToken" placeholder="whatsapp-crm-verify-2026" />
            <small class="field-hint">Use same token in Meta webhook configuration.</small>
          </label>
        </div>
        <p class="dim modal-note">Access token stays hidden. Leave it blank to keep the current token unchanged.</p>
        <div class="modal-actions">
          <button @click="applySuggestedCredentials">Use examples</button>
          <button @click="closeWhatsAppModal">Cancel</button>
          <button class="primary" @click="saveWhatsAppConfig" :disabled="whatsappSaving">
            {{ whatsappSaving ? "Saving..." : "Save credentials" }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="showAuthModal" class="modal-backdrop">
      <section class="modal-card auth-card">
        <h3>Unlock dashboard</h3>
        <p class="dim">This app has API password protection enabled. Enter the password to continue.</p>
        <label>
          App password
          <input
            v-model="authPasswordInput"
            type="password"
            autocomplete="current-password"
            placeholder="Enter app password"
            @keyup.enter="unlockDashboard"
          />
        </label>
        <div class="modal-actions">
          <button @click="clearSavedPassword">Clear saved</button>
          <button class="primary" @click="unlockDashboard" :disabled="authSaving">
            {{ authSaving ? "Unlocking..." : "Unlock" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  --panel-base: rgba(11, 20, 19, 0.9);
  --panel-elevated: rgba(13, 25, 23, 0.94);
  --panel-soft: rgba(15, 29, 27, 0.76);
  --line-main: #2b4f43;
  --line-soft: #1d3730;
  --text-main: #e7f2ec;
  --text-muted: #98b5aa;
  --accent-main: #1ea667;
  --accent-strong: #27bf78;

  position: relative;
  max-width: 1360px;
  margin: 0 auto;
  padding: 34px 24px 64px;
  font-size: 0.94rem;
  color: var(--text-main);
  min-height: 100vh;
  overflow: visible;
}

.bg-blob {
  display: none;
}

.bg-ring {
  display: none;
}

.topbar {
  position: sticky;
  top: 10px;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: linear-gradient(180deg, rgba(14, 28, 25, 0.96), rgba(10, 19, 18, 0.95));
  border: 1px solid var(--line-main);
  border-radius: 18px;
  padding: 13px 17px;
  margin-bottom: 16px;
  backdrop-filter: none;
  box-shadow: 0 16px 40px rgba(1, 10, 9, 0.34);
}

.brand {
  font-size: 1rem;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: #a8e4c8;
}

.top-nav {
  display: flex;
  gap: 14px;
  align-items: center;
}

.top-nav a {
  text-decoration: none;
  color: #9fbaaf;
  font-size: 0.82rem;
  transition: color 0.2s ease, opacity 0.2s ease;
  opacity: 0.9;
}

.nav-link-button {
  border: 0;
  background: transparent;
  color: #9fbaaf;
  font-size: 0.82rem;
  padding: 0;
  opacity: 0.9;
}

.top-nav a:hover {
  color: #c5f4df;
  opacity: 1;
}

.top-nav .nav-link-button:hover {
  color: #c5f4df;
  opacity: 1;
}

.hero {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: start;
  margin-bottom: 16px;
  background: linear-gradient(165deg, rgba(14, 31, 27, 0.95), rgba(10, 21, 20, 0.94));
  border: 1px solid var(--line-main);
  border-radius: 18px;
  padding: 18px;
  backdrop-filter: none;
  box-shadow: 0 18px 40px rgba(2, 12, 11, 0.36);
}

.hero-actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.connect-stack {
  display: grid;
  gap: 5px;
  align-items: flex-start;
}

.connection-status {
  font-size: 0.73rem;
  color: #9db7ac;
  margin-left: 2px;
}

.connection-status[data-connected="true"] {
  color: #89edbc;
}

.connection-status[data-connected="false"] {
  color: #95a9a1;
}

h1 {
  margin: 6px 0;
  font-size: 1.95rem;
  color: #e2f8ec;
  letter-spacing: -0.01em;
}

.subhead {
  margin: 0;
  max-width: 70ch;
  font-size: 0.92rem;
  color: var(--text-muted);
}

.refresh {
  border: 1px solid #365949;
  background: linear-gradient(180deg, rgba(27, 46, 40, 0.95), rgba(18, 34, 30, 0.95));
  color: #b7d6c8;
  border-radius: 11px;
  font-size: 0.86rem;
  padding: 7px 12px;
  transition: border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
  box-shadow: 0 10px 22px rgba(3, 13, 12, 0.28);
}

.connect-whatsapp {
  border: 1px solid #29a66d;
  background: linear-gradient(135deg, #1d9a63, #29c478);
  color: #fff;
  border-radius: 11px;
  font-size: 0.86rem;
  padding: 7px 12px;
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
  box-shadow: 0 12px 24px rgba(18, 113, 72, 0.36);
}

.refresh:hover {
  border-color: #4a7a65;
  color: #d1ece1;
  transform: translateY(-1px);
}

.connect-whatsapp:hover {
  background: linear-gradient(135deg, #22a96c, #32cb82);
  transform: translateY(-1px);
}

.error-banner {
  margin: 0 0 16px;
  border: 1px solid #7b3042;
  background: rgba(72, 20, 34, 0.72);
  color: #ffc5d2;
  border-radius: 10px;
  padding: 10px 12px;
}

.success-banner {
  margin: 0 0 16px;
  border: 1px solid #2a7d56;
  background: rgba(19, 92, 59, 0.42);
  color: #d8ffec;
  border-radius: 10px;
  padding: 10px 12px;
}

.setup-card {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  background: linear-gradient(160deg, rgba(14, 29, 26, 0.95), rgba(10, 21, 19, 0.95));
  box-shadow: 0 16px 36px rgba(2, 12, 11, 0.3);
}

.setup-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setup-progress {
  font-size: 0.78rem;
  border-radius: 999px;
  border: 1px solid #326754;
  background: rgba(21, 60, 48, 0.48);
  padding: 3px 9px;
  color: #bbe9d2;
}

.setup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.setup-step-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.setup-step {
  border: 1px solid #33574b;
  border-radius: 12px;
  padding: 10px;
  background: linear-gradient(180deg, rgba(12, 24, 22, 0.92), rgba(10, 20, 19, 0.9));
  display: grid;
  gap: 10px;
}

.setup-step h4 {
  margin: 0;
  font-size: 0.9rem;
  color: #d3efe2;
}

.setup-step[data-done="true"] {
  border-color: #3c936d;
  background: linear-gradient(180deg, rgba(20, 66, 50, 0.68), rgba(15, 47, 38, 0.62));
}

.onboarding-progress {
  height: 8px;
  border-radius: 999px;
  border: 1px solid #315d50;
  background: rgba(10, 20, 19, 0.9);
  overflow: hidden;
}

.onboarding-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #23a86d, #39d98d);
  box-shadow: 0 0 18px rgba(33, 171, 108, 0.5);
  transition: width 0.25s ease;
}

.setup-copy {
  margin: 0;
  color: #95b6a9;
  font-size: 0.81rem;
  line-height: 1.45;
}

.setup-grid p {
  margin: 0;
  border: 1px solid #2e5247;
  border-radius: 10px;
  padding: 7px 8px;
  color: #90afa1;
  background: rgba(10, 20, 19, 0.82);
}

.setup-grid p[data-done="true"] {
  border-color: #31a571;
  background: rgba(29, 101, 71, 0.36);
  color: #def7eb;
}

.setup-inline {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.setup-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.setup-actions button {
  font-size: 0.8rem;
  padding: 6px 9px;
}

.stats-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stats-grid article {
  background: rgba(12, 22, 20, 0.94);
  border: 1px solid #2a4c40;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 12px 28px rgba(2, 10, 10, 0.25);
}

.stats-grid h2 {
  margin: 0;
  font-size: 1.7rem;
  color: #9ce7c3;
}

.stats-grid p {
  margin: 6px 0 0;
  color: #94b4a7;
}

.stats-grid-inline {
  margin-bottom: 0;
}

.crm-overview {
  margin-bottom: 16px;
  display: grid;
  gap: 12px;
}

.crm-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.crm-stats-grid article {
  border: 1px solid #33584b;
  border-radius: 12px;
  padding: 10px;
  background: rgba(12, 24, 22, 0.86);
}

.crm-stats-grid h4 {
  margin: 0;
  font-size: 1.2rem;
  color: #aee8cb;
}

.crm-stats-grid p {
  margin: 4px 0 0;
  color: #90b0a3;
  font-size: 0.82rem;
}

.crm-toolbar {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 10px;
}

.crm-list {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow: auto;
}

.crm-item {
  border: 1px solid #31564a;
  border-radius: 12px;
  padding: 10px;
  background: rgba(10, 20, 19, 0.9);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.crm-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.crm-item-main p {
  margin: 4px 0 0;
}

.crm-item-meta {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.source-chip {
  border: 1px solid #396556;
  border-radius: 999px;
  font-size: 0.68rem;
  padding: 2px 8px;
  color: #b7dfcd;
  background: rgba(20, 57, 46, 0.56);
}

.workspace {
  position: relative;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

#inbox,
#crm,
#automation,
#automations,
#templates {
  scroll-margin-top: 92px;
}

#lead-capture {
  scroll-margin-top: 92px;
}

.inbox-panel,
.card {
  background: linear-gradient(165deg, rgba(14, 30, 27, 0.95), rgba(9, 20, 19, 0.95));
  border: 1px solid #2a4d41;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(1, 9, 9, 0.28);
}

.conversation-card {
  background: linear-gradient(165deg, rgba(12, 30, 27, 0.98), rgba(8, 21, 20, 0.98));
  border-color: #3f896f;
  box-shadow: 0 18px 40px rgba(3, 17, 14, 0.36), 0 0 0 1px rgba(48, 138, 97, 0.22);
}

.conversation-card h3 {
  color: #d4ffe9;
}

.toolbar-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.toolbar-row input {
  font-size: 0.84rem;
}

.toolbar-subrow {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.toggle-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #8fb4a7;
}

.toggle-inline input[type="checkbox"] {
  accent-color: #1fb86a;
}

.toolbar-row input,
.toolbar-row select,
.inline-form input,
.inline-form select,
.meta-grid select,
.meta-grid input,
input:not([type="checkbox"]),
textarea {
  width: 100%;
  border: 1px solid #335d50;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.9rem;
  background: rgba(9, 17, 17, 0.94);
  color: #deefe7;
  transition: border-color 0.16s ease;
}

textarea {
  padding-right: 9px;
}

select {
  width: 100%;
  border: 1px solid #335d50;
  border-radius: 10px;
  padding: 8px 11px;
  padding-right: 38px;
  font-size: 0.9rem;
  background: rgba(9, 17, 17, 0.94);
  color: #deefe7;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239feec6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 13px center;
  background-size: 14px 14px;
}

select::-ms-expand {
  display: none;
}

input::placeholder,
textarea::placeholder {
  color: #81a498;
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible,
.date-trigger:focus-visible,
.time-trigger:focus-visible {
  outline: none;
  border-color: #4b8b73;
  box-shadow: none;
}

.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
  max-height: 680px;
  overflow: auto;
}

.conversation-list li {
  border: 1px solid #2b4f43;
  border-radius: 11px;
  padding: 10px;
  cursor: pointer;
  background: rgba(10, 18, 17, 0.9);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.conversation-list li:hover {
  border-color: #4d856f;
  background: rgba(14, 26, 24, 0.92);
  transform: none;
}

.conversation-list li.active {
  border-color: #3a8a67;
  background: rgba(20, 54, 43, 0.62);
  box-shadow: none;
}

.conversation-list li.inserted {
  animation: none;
}

.line1 {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.list-actions {
  margin-top: 8px;
  display: flex;
  gap: 6px;
}

.list-actions button {
  padding: 4px 7px;
  font-size: 0.75rem;
}

.pill {
  font-size: 0.68rem;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid #3f6a5b;
}

.pill[data-state="NEW"] {
  background: rgba(28, 132, 84, 0.26);
  border-color: #49b97f;
}

.pill[data-state="FOLLOW_UP"] {
  background: rgba(69, 139, 88, 0.26);
  border-color: #4bc189;
}

.pill[data-state="CLOSED"] {
  background: rgba(73, 99, 90, 0.34);
  border-color: #5e7f73;
}

.dim {
  color: #83a69a;
}

.conversation-list p,
.conversation-list small {
  margin: 0;
}

.detail-panel {
  display: grid;
  gap: 14px;
}

h3 {
  margin-top: 0;
  margin-bottom: 6px;
  font-size: 1.02rem;
  color: #bfffdc;
}

.meta-grid {
  display: grid;
  grid-template-columns: minmax(170px, 220px) minmax(280px, 420px) auto;
  gap: 10px;
  align-items: start;
  margin-bottom: 10px;
}

.meta-field {
  display: grid;
  gap: 6px;
}

.meta-action {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 38px;
}

.meta-save-btn {
  width: auto;
  min-width: 240px;
  max-width: 300px;
  white-space: nowrap;
}

.conversation-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.followup-field {
  position: relative;
  display: grid;
  gap: 8px;
}

.automation-time-field {
  position: relative;
}

.date-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #335d50;
  background: rgba(9, 17, 17, 0.94);
  border-radius: 10px;
  padding: 8px 10px;
  color: #deefe7;
  font-size: 0.9rem;
}

.time-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #335d50;
  background: rgba(9, 17, 17, 0.94);
  border-radius: 10px;
  padding: 8px 10px;
  color: #deefe7;
  font-size: 0.9rem;
}

.time-icons {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.clock-icon {
  opacity: 0.78;
  font-size: 0.9rem;
}

.time-arrow {
  opacity: 0.86;
  font-size: 1rem;
  line-height: 1;
}

.picker-hint {
  font-size: 0.72rem;
  color: #88a99e;
}

.calendar-icon {
  opacity: 0.85;
}

.calendar-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 290px;
  background: #0f1c1d;
  border: 1px solid #2f5a4f;
  border-radius: 14px;
  padding: 10px;
  z-index: 72;
  box-shadow: 0 14px 32px rgba(2, 10, 10, 0.34);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.calendar-header button {
  min-width: 30px;
  padding: 4px 8px;
}

.calendar-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.calendar-month-select {
  min-width: 130px;
  padding-top: 5px;
  padding-bottom: 5px;
  font-size: 0.82rem;
}

.calendar-year {
  font-size: 0.82rem;
  color: #cfe9dd;
  border: 1px solid #2f5a4f;
  border-radius: 999px;
  padding: 3px 7px;
  background: rgba(17, 40, 33, 0.55);
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.calendar-weekdays span {
  text-align: center;
  font-size: 0.74rem;
  color: #8cb5a7;
  padding: 3px 0;
}

.calendar-day {
  padding: 5px 0;
  border-radius: 7px;
  border: 1px solid #30584c;
  background: rgba(14, 29, 24, 0.58);
  color: #d9efe5;
  font-size: 0.8rem;
}

.calendar-day.empty {
  border-color: transparent;
  background: transparent;
  pointer-events: none;
}

.calendar-day.selected {
  border-color: #36a574;
  background: rgba(41, 137, 93, 0.33);
  color: #f2fff9;
}

.time-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 160px;
  max-height: 210px;
  overflow: auto;
  background: #0f1c1d;
  border: 1px solid #2f5a4f;
  border-radius: 14px;
  padding: 8px;
  z-index: 72;
  box-shadow: 0 14px 32px rgba(2, 10, 10, 0.34);
  display: grid;
  gap: 6px;
}

.automation-time-field .time-popover {
  width: 100%;
  max-height: 220px;
}

.time-option {
  width: 100%;
  text-align: left;
  border: 1px solid #30584c;
  border-radius: 8px;
  background: rgba(14, 29, 24, 0.58);
  color: #d9efe5;
  padding: 6px 8px;
  font-size: 0.82rem;
}

.time-option.selected {
  border-color: #36a574;
  background: rgba(41, 137, 93, 0.33);
  color: #f2fff9;
}

.calendar-overlay {
  position: fixed;
  inset: 0;
  z-index: 64;
}

.messages {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow: auto;
  padding-right: 2px;
}

.message {
  border: 1px solid #315549;
  border-radius: 12px;
  padding: 10px;
  background: rgba(11, 21, 20, 0.88);
}

.message.inbound {
  border-left: 4px solid #2ead71;
}

.message.outbound {
  border-left: 4px solid #2b8f78;
}

.message.system {
  border-left: 4px solid #0b7d68;
}

.message header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.message p {
  margin: 8px 0 0;
}

.status-chip {
  display: inline-block;
  margin-top: 7px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  border: 1px solid #355d50;
  color: #b7d4c8;
}

.status-chip[data-tone="ok"] {
  border-color: #33aa73;
  color: #d9ffee;
  background: rgba(28, 143, 87, 0.26);
}

.status-chip[data-tone="pending"] {
  border-color: #7d9f3f;
  color: #ebf9d0;
  background: rgba(122, 142, 45, 0.24);
}

.status-chip[data-tone="error"] {
  border-color: #af4360;
  color: #ffdbe5;
  background: rgba(130, 42, 65, 0.32);
}

.composer {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.template-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.template-strip button,
button {
  border: 1px solid #375a4e;
  background: linear-gradient(180deg, rgba(27, 45, 40, 0.9), rgba(18, 33, 30, 0.9));
  border-radius: 10px;
  padding: 6px 11px;
  font-size: 0.86rem;
  color: #b3decb;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  box-shadow: 0 10px 20px rgba(1, 9, 8, 0.22);
}

button.primary {
  border-color: #2ea46e;
  background: linear-gradient(135deg, #1f9d64, #2ac479);
  color: white;
  box-shadow: 0 12px 26px rgba(18, 111, 72, 0.34);
}

button:hover {
  transform: translateY(-1px);
  border-color: #4a7b66;
}

button.primary:hover {
  border-color: #49b580;
}

.notes-list {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  margin-bottom: 8px;
}

.notes-list article {
  border: 1px solid #2e5247;
  border-radius: 11px;
  padding: 8px;
  background: rgba(11, 21, 20, 0.88);
}

.inline-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.form-stack {
  display: grid;
  gap: 11px;
}

.automation-card {
  display: grid;
  gap: 12px;
}

.automation-safety {
  border: 1px solid #335b4f;
  border-radius: 12px;
  padding: 9px;
  background: rgba(13, 24, 23, 0.82);
}

.automation-safety p {
  margin: 0 0 6px;
  color: #95baac;
}

.automation-safety p:last-child {
  margin-bottom: 0;
}

.error-mini {
  color: #ffc8d6;
}

.warning-mini {
  color: #f6f2c2;
}

.automation-toggle-list {
  display: grid;
  gap: 9px;
}

.automation-toggle-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #2f5247;
  border-radius: 11px;
  background: rgba(12, 22, 21, 0.8);
}

.automation-toggle-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #1fb86a;
}

.feature-label {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  border: 1px solid #4f7064;
  color: #9ab8ad;
}

.feature-label[data-enabled="true"] {
  border-color: #33aa73;
  color: #d9ffee;
  background: rgba(28, 143, 87, 0.26);
}

.template-manager-card .template-manager-form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.grid-2 {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.grid-1 {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 10px 0;
}

.template-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
  max-height: 200px;
  overflow: auto;
}

.template-list li {
  border: 1px solid #2f5247;
  border-radius: 11px;
  padding: 8px;
  background: rgba(11, 21, 20, 0.88);
}

.template-list p {
  margin: 6px 0;
}

.card-hint {
  margin: 0;
  color: #8fb8aa;
  font-size: 0.84rem;
}

.link-button {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: #8ef0bd;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 0;
  font-size: 0.84rem;
}

.scroll-top {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 70;
  border: 1px solid #3b6556;
  border-radius: 999px;
  background: rgba(13, 26, 22, 0.88);
  color: #c5e8d8;
  font-size: 0.8rem;
  text-decoration: none;
  padding: 7px 11px;
  box-shadow: 0 10px 24px rgba(2, 8, 8, 0.3);
}

.field-hint {
  display: block;
  margin-top: 6px;
  color: #8caea1;
  font-size: 0.75rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 11, 16, 0.72);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 50;
}

.modal-card {
  width: min(680px, 100%);
  background: linear-gradient(175deg, rgba(15, 30, 27, 0.98), rgba(10, 20, 19, 0.98));
  border: 1px solid #315448;
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 24px 50px rgba(1, 7, 7, 0.42);
}

.modal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.modal-note {
  margin: 10px 0 0;
}

.modal-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.modal-actions-left {
  margin-top: 10px;
  justify-content: flex-start;
}

.auth-card {
  width: min(460px, 100%);
}

@keyframes insertedPulse {
  0% {
    box-shadow: none;
  }
  100% {
    box-shadow: none;
  }
}

@media (max-width: 1180px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 1020px) {
  .hero {
    flex-direction: column;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .grid-2 {
    grid-template-columns: 1fr;
  }

  .grid-1 {
    grid-template-columns: 1fr;
  }

  .crm-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .crm-toolbar {
    grid-template-columns: 1fr;
  }

  .crm-item {
    grid-template-columns: 1fr;
  }

  .meta-grid,
  .triple,
  .inline-form,
  .modal-grid,
  .setup-inline {
    grid-template-columns: 1fr;
  }

  .meta-action {
    padding-top: 0;
  }

  .meta-save-btn {
    width: 100%;
    max-width: none;
  }

  .setup-grid {
    grid-template-columns: 1fr;
  }

  .setup-step-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .crm-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
