<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "./api";

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

const loading = ref(false);
const error = ref("");
const showWhatsAppModal = ref(false);
const whatsappSaving = ref(false);
const whatsappConnected = ref(false);

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

const conversations = ref([]);
const selectedConversationId = ref("");
const selectedConversation = ref(null);

const noteInput = ref("");
const messageInput = ref("");
const followUpDate = ref("");
const followUpTime = ref("09:00");
const showFollowUpCalendar = ref(false);
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

const simulatedInbound = reactive({
  name: "",
  phone: "",
  text: ""
});

const wordpressLead = reactive({
  name: "",
  phone: "",
  message: "",
  sourceUrl: "https://example.com/contact"
});

const states = ["ALL", "NEW", "FOLLOW_UP", "CLOSED"];

const selectedMessages = computed(() => selectedConversation.value?.messages || []);
const selectedNotes = computed(() => selectedConversation.value?.notes || []);
const calendarMonthLabel = computed(() => `${CALENDAR_MONTHS[calendarMonth.value]} ${FOLLOW_UP_YEAR}`);
const canGoPreviousMonth = computed(() => calendarMonth.value > 0);
const canGoNextMonth = computed(() => calendarMonth.value < 11);
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

const loadConversations = async () => {
  const data = await api.getConversations(buildConversationQuery());
  conversations.value = data;

  if (!data.find((entry) => entry.id === selectedConversationId.value)) {
    selectedConversationId.value = data[0]?.id || "";
  }
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
    const [nextAnalytics, nextTemplates, nextAutomation, nextWhatsAppConfig] = await Promise.all([
      api.getAnalytics(),
      api.getTemplates(),
      api.getAutomation(),
      api.getWhatsAppConfig()
    ]);

    analytics.value = nextAnalytics;
    templates.value = nextTemplates;
    Object.assign(automation, nextAutomation || {});
    applyWhatsAppConfig(nextWhatsAppConfig || {});

    await loadConversations();
    await loadSelectedConversation();
  } catch (err) {
    error.value = err.message;
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
    error.value = err.message;
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
  } catch (err) {
    error.value = err.message;
  } finally {
    whatsappSaving.value = false;
  }
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

    await loadConversations();
    await loadSelectedConversation();
    analytics.value = await api.getAnalytics();
  } catch (err) {
    error.value = err.message;
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
  } catch (err) {
    error.value = err.message;
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
    await loadConversations();
    await loadSelectedConversation();
    analytics.value = await api.getAnalytics();
  } catch (err) {
    error.value = err.message;
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
  } catch (err) {
    error.value = err.message;
  }
};

const saveAutomation = async () => {
  try {
    const data = await api.updateAutomation({ ...automation });
    Object.assign(automation, data);
  } catch (err) {
    error.value = err.message;
  }
};

const runInboundSimulation = async () => {
  if (!simulatedInbound.phone.trim() || !simulatedInbound.text.trim()) {
    return;
  }

  try {
    await api.simulateInbound({
      name: simulatedInbound.name || "Unknown",
      phone: simulatedInbound.phone,
      text: simulatedInbound.text
    });

    simulatedInbound.name = "";
    simulatedInbound.phone = "";
    simulatedInbound.text = "";
    await refreshDashboard();
  } catch (err) {
    error.value = err.message;
  }
};

const submitWordPressLead = async () => {
  if (!wordpressLead.phone.trim() || !wordpressLead.message.trim()) {
    return;
  }

  try {
    await api.pushWordPressLead({
      ...wordpressLead
    });

    wordpressLead.name = "";
    wordpressLead.phone = "";
    wordpressLead.message = "";
    await refreshDashboard();
  } catch (err) {
    error.value = err.message;
  }
};

watch(
  () => [filters.state, filters.search],
  async () => {
    try {
      await loadConversations();
      await loadSelectedConversation();
    } catch (err) {
      error.value = err.message;
    }
  }
);

watch(selectedConversationId, async () => {
  try {
    await loadSelectedConversation();
  } catch (err) {
    error.value = err.message;
  }
});

onMounted(refreshDashboard);
</script>

<template>
  <div class="app-shell">
    <div class="bg-blob"></div>
    <div class="bg-ring"></div>

    <header class="topbar">
      <div class="brand">&lt;/&gt; WhatsAppCRM</div>
      <nav class="top-nav">
        <a href="#inbox">Inbox</a>
        <a href="#automation">Automation</a>
        <a href="#templates">Templates</a>
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
        <span class="connection-pill" :data-connected="whatsappConnected">
          {{ whatsappConnected ? "WhatsApp connected" : "WhatsApp not connected" }}
        </span>
        <button class="connect-whatsapp" @click="openWhatsAppModal">Connect your WhatsApp</button>
        <button class="refresh" @click="refreshDashboard" :disabled="loading">{{ loading ? "Refreshing..." : "Refresh" }}</button>
      </div>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <section class="stats-grid">
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

    <section class="workspace" id="inbox">
      <aside class="inbox-panel">
        <div class="toolbar-row">
          <select v-model="filters.state">
            <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
          </select>
          <input v-model="filters.search" placeholder="Search by name, phone, or text" />
        </div>

        <ul class="conversation-list">
          <li
            v-for="item in conversations"
            :key="item.id"
            :class="{ active: item.id === selectedConversationId }"
            @click="selectedConversationId = item.id"
          >
            <div class="line1">
              <strong>{{ item.name }}</strong>
              <span class="pill" :data-state="item.state">{{ item.state }}</span>
            </div>
            <p>{{ item.phone }}</p>
            <p class="dim">{{ item.lastMessageText }}</p>
            <small>{{ formatDate(item.lastMessageAt) }}</small>
          </li>
        </ul>
      </aside>

      <main class="detail-panel" v-if="selectedConversation">
        <section class="card">
          <h3>Conversation</h3>
          <div class="meta-grid">
            <label>
              State
              <select v-model="selectedConversation.state">
                <option value="NEW">NEW</option>
                <option value="FOLLOW_UP">FOLLOW_UP</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </label>
            <label>
              Follow-up date
              <div class="followup-field">
                <button type="button" class="date-trigger" @click="openFollowUpCalendar">
                  <span>{{ formatFollowUpDisplay(followUpDate, followUpTime) }}</span>
                  <span class="calendar-icon">📅</span>
                </button>
                <input v-model="followUpTime" type="time" />
                <div v-if="showFollowUpCalendar" class="calendar-popover">
                  <div class="calendar-header">
                    <button type="button" @click="goToPreviousMonth" :disabled="!canGoPreviousMonth">‹</button>
                    <strong>{{ calendarMonthLabel }}</strong>
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
            <button class="primary" @click="saveConversationMeta">Save state & follow-up</button>
          </div>

          <div class="messages">
            <article v-for="message in selectedMessages" :key="message.id" :class="['message', message.direction.toLowerCase()]">
              <header>
                <strong>{{ message.direction }}</strong>
                <small>{{ formatDate(message.createdAt) }}</small>
              </header>
              <p>{{ message.text }}</p>
              <small v-if="message.status">status: {{ message.status }}</small>
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

      <main class="detail-panel" v-else>
        <section class="card">
          <p>Select a conversation from the inbox.</p>
        </section>
      </main>
    </section>

    <section class="grid-2" id="automation">
      <article class="card">
        <h3>Automation Settings</h3>
        <label><input type="checkbox" v-model="automation.autoReplyOnFirstInquiry" /> Auto-reply on first inquiry</label>
        <label><input type="checkbox" v-model="automation.businessHoursReplyEnabled" /> After-hours auto-reply</label>
        <label><input type="checkbox" v-model="automation.followUpReminderEnabled" /> Follow-up reminders</label>

        <div class="triple">
          <label>
            Timezone
            <input v-model="automation.timezone" placeholder="Asia/Kolkata" />
          </label>
          <label>
            Start
            <input v-model="automation.businessHoursStart" type="time" />
          </label>
          <label>
            End
            <input v-model="automation.businessHoursEnd" type="time" />
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

        <button class="primary" @click="saveAutomation">Save automation</button>
      </article>

      <article class="card">
        <h3>Template Manager</h3>
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

        <ul class="template-list">
          <li v-for="template in templates" :key="template.id">
            <strong>{{ template.name }}</strong>
            <p>{{ template.body }}</p>
            <small>{{ template.category }}</small>
          </li>
        </ul>
      </article>
    </section>

    <section class="grid-2" id="templates">
      <article class="card">
        <h3>Inbound Simulation (for demos)</h3>
        <div class="inline-form">
          <input v-model="simulatedInbound.name" placeholder="Contact name" />
          <input v-model="simulatedInbound.phone" placeholder="Phone (+91...)" />
        </div>
        <textarea v-model="simulatedInbound.text" rows="3" placeholder="Inbound WhatsApp message"></textarea>
        <button class="primary" @click="runInboundSimulation">Ingest inbound</button>
      </article>

      <article class="card">
        <h3>WordPress Lead -> WhatsApp CRM</h3>
        <div class="inline-form">
          <input v-model="wordpressLead.name" placeholder="Lead name" />
          <input v-model="wordpressLead.phone" placeholder="Phone (+91...)" />
        </div>
        <textarea v-model="wordpressLead.message" rows="3" placeholder="Lead message"></textarea>
        <input v-model="wordpressLead.sourceUrl" placeholder="WordPress page URL" />
        <button class="primary" @click="submitWordPressLead">Push lead</button>
      </article>
    </section>

    <div v-if="showFollowUpCalendar" class="calendar-overlay" @click="closeFollowUpCalendar"></div>

    <div v-if="showWhatsAppModal" class="modal-backdrop" @click.self="closeWhatsAppModal">
      <section class="modal-card">
        <h3>Connect your WhatsApp</h3>
        <p class="dim">
          Add your WhatsApp Business API credentials. This enables real message sending from the dashboard.
        </p>
        <div class="modal-grid">
          <label>
            Business phone number
            <input v-model="whatsappConfig.businessPhone" placeholder="+91..." />
          </label>
          <label>
            Phone number ID
            <input v-model="whatsappConfig.phoneNumberId" placeholder="Meta phone number ID" />
          </label>
          <label>
            Access token
            <input v-model="whatsappConfig.accessToken" type="password" placeholder="Meta access token" />
          </label>
          <label>
            Webhook verify token
            <input v-model="whatsappConfig.verifyToken" placeholder="Verify token used in Meta webhook setup" />
          </label>
        </div>
        <p class="dim modal-note">Access token stays hidden. Leave it blank to keep the current token unchanged.</p>
        <div class="modal-actions">
          <button @click="closeWhatsAppModal">Cancel</button>
          <button class="primary" @click="saveWhatsAppConfig" :disabled="whatsappSaving">
            {{ whatsappSaving ? "Saving..." : "Save credentials" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  max-width: 1320px;
  margin: 0 auto;
  padding: 30px 20px 56px;
  font-size: 0.95rem;
  color: #e7f7ef;
  min-height: 100vh;
  overflow: hidden;
}

.bg-blob {
  position: absolute;
  width: 460px;
  height: 460px;
  right: -150px;
  top: -180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 211, 102, 0.45) 0%, rgba(37, 211, 102, 0) 70%);
  pointer-events: none;
  z-index: 0;
}

.bg-ring {
  position: absolute;
  width: 620px;
  height: 620px;
  left: -340px;
  bottom: -420px;
  border-radius: 50%;
  border: 1px solid rgba(43, 241, 140, 0.16);
  pointer-events: none;
  z-index: 0;
}

.topbar {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: rgba(11, 20, 29, 0.84);
  border: 1px solid #1b3a33;
  border-radius: 16px;
  padding: 12px 16px;
  margin-bottom: 14px;
  backdrop-filter: blur(6px);
}

.brand {
  font-size: 0.98rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: #84f7c5;
}

.top-nav {
  display: flex;
  gap: 14px;
  align-items: center;
}

.top-nav a {
  text-decoration: none;
  color: #99c6b5;
  font-size: 0.82rem;
  transition: color 0.2s ease;
}

.top-nav a:hover {
  color: #7df0bc;
}

.hero {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: start;
  margin-bottom: 14px;
  background: rgba(11, 20, 29, 0.84);
  border: 1px solid #1b3a33;
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(6px);
}

.hero-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.connection-pill {
  font-size: 0.72rem;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid #296b56;
  background: rgba(25, 93, 66, 0.25);
  color: #89edbb;
}

.connection-pill[data-connected="false"] {
  border-color: #344f46;
  background: rgba(22, 36, 31, 0.55);
  color: #8ea89e;
}

h1 {
  margin: 6px 0;
  font-size: 1.85rem;
  color: #d8ffec;
}

.subhead {
  margin: 0;
  max-width: 70ch;
  font-size: 0.92rem;
  color: #9dc2b5;
}

.refresh {
  border: 1px solid #2c715b;
  background: rgba(20, 54, 44, 0.7);
  color: #9aeec4;
  border-radius: 10px;
  font-size: 0.86rem;
  padding: 7px 11px;
}

.connect-whatsapp {
  border: 1px solid #24c777;
  background: linear-gradient(130deg, #179f63, #1dcf77);
  color: #fff;
  border-radius: 10px;
  font-size: 0.86rem;
  padding: 7px 11px;
  box-shadow: 0 8px 18px rgba(20, 160, 95, 0.3);
}

.error-banner {
  margin: 0 0 16px;
  border: 1px solid #7b3042;
  background: rgba(72, 20, 34, 0.72);
  color: #ffc5d2;
  border-radius: 10px;
  padding: 10px 12px;
}

.stats-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stats-grid article {
  background: rgba(9, 18, 25, 0.88);
  border: 1px solid #1d3d35;
  border-radius: 14px;
  padding: 14px;
}

.stats-grid h2 {
  margin: 0;
  font-size: 1.7rem;
  color: #7ef2b9;
}

.stats-grid p {
  margin: 6px 0 0;
  color: #86ab9d;
}

.workspace {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.inbox-panel,
.card {
  background: rgba(9, 18, 25, 0.9);
  border: 1px solid #1d3d35;
  border-radius: 14px;
  padding: 14px;
  box-shadow: inset 0 1px 0 rgba(165, 232, 199, 0.05);
}

.toolbar-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.toolbar-row input,
.toolbar-row select,
.inline-form input,
.inline-form select,
.meta-grid select,
.meta-grid input,
input,
textarea,
select {
  width: 100%;
  border: 1px solid #2a5a4b;
  border-radius: 9px;
  padding: 7px 9px;
  font-size: 0.9rem;
  background: rgba(8, 16, 23, 0.9);
  color: #e2fff1;
}

input::placeholder,
textarea::placeholder {
  color: #7aa193;
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
  border: 1px solid #24473e;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  background: rgba(10, 19, 27, 0.78);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.conversation-list li:hover {
  border-color: #35a879;
  transform: translateY(-1px);
}

.conversation-list li.active {
  border-color: #25d366;
  background: rgba(19, 64, 48, 0.62);
  box-shadow: 0 0 0 1px rgba(38, 211, 102, 0.2);
}

.line1 {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
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
  font-size: 1.02rem;
  color: #bfffdc;
}

.meta-grid {
  display: grid;
  grid-template-columns: 180px 220px 1fr;
  gap: 10px;
  align-items: end;
  margin-bottom: 10px;
}

.followup-field {
  position: relative;
  display: grid;
  gap: 8px;
}

.date-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #2a5a4b;
  background: rgba(8, 16, 23, 0.9);
  border-radius: 9px;
  padding: 7px 9px;
  color: #e2fff1;
  font-size: 0.9rem;
}

.calendar-icon {
  opacity: 0.85;
}

.calendar-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 290px;
  background: #0b1720;
  border: 1px solid #245245;
  border-radius: 12px;
  padding: 10px;
  z-index: 60;
  box-shadow: 0 14px 30px rgba(2, 9, 13, 0.45);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.calendar-header button {
  min-width: 30px;
  padding: 4px 8px;
}

.calendar-header strong {
  font-size: 0.9rem;
  color: #bfffdc;
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
  border: 1px solid #22483d;
  background: rgba(12, 25, 18, 0.55);
  color: #d6fff0;
  font-size: 0.8rem;
}

.calendar-day.empty {
  border-color: transparent;
  background: transparent;
  pointer-events: none;
}

.calendar-day.selected {
  border-color: #25d366;
  background: rgba(29, 163, 95, 0.35);
  color: #ecfff5;
}

.calendar-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.messages {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow: auto;
  padding-right: 2px;
}

.message {
  border: 1px solid #284b41;
  border-radius: 11px;
  padding: 10px;
  background: rgba(8, 16, 23, 0.75);
}

.message.inbound {
  border-left: 4px solid #25d366;
}

.message.outbound {
  border-left: 4px solid #128c7e;
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
  border: 1px solid #2a5d4d;
  background: rgba(17, 34, 28, 0.72);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.86rem;
  color: #9feec6;
}

button.primary {
  border-color: #1dbf72;
  background: linear-gradient(130deg, #148f5a, #1ec877);
  color: white;
}

.notes-list {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  margin-bottom: 8px;
}

.notes-list article {
  border: 1px solid #23463c;
  border-radius: 10px;
  padding: 8px;
  background: rgba(8, 16, 23, 0.72);
}

.inline-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.grid-2 {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.template-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: grid;
  gap: 8px;
  max-height: 200px;
  overflow: auto;
}

.template-list li {
  border: 1px solid #23463c;
  border-radius: 10px;
  padding: 8px;
  background: rgba(8, 16, 23, 0.72);
}

.template-list p {
  margin: 6px 0;
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
  background: #0c1821;
  border: 1px solid #245245;
  border-radius: 16px;
  padding: 16px;
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

  .meta-grid,
  .triple,
  .inline-form,
  .modal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
