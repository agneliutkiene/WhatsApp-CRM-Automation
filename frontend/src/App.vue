<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "./api";

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
const followUpInput = ref("");

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

const isoToInput = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const inputToIso = (value) => {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
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
  followUpInput.value = isoToInput(data.followUpAt);
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
      followUpAt: inputToIso(followUpInput.value)
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

    <section class="workspace">
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
              Follow-up time
              <input v-model="followUpInput" type="datetime-local" />
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

    <section class="grid-2">
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

    <section class="grid-2">
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 20px 48px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: start;
  margin-bottom: 18px;
}

.hero-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.connection-pill {
  font-size: 0.78rem;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid #9fd4be;
  background: #f0fff7;
  color: #0c5f52;
}

.connection-pill[data-connected="false"] {
  border-color: #bccdc7;
  background: #f4f8f6;
  color: #4f6860;
}

h1 {
  margin: 6px 0;
  font-size: 2rem;
  color: #075e54;
}

.subhead {
  margin: 0;
  max-width: 70ch;
  color: #1f584d;
}

.refresh {
  border: 1px solid #0b7d68;
  background: #dff8eb;
  color: #075e54;
  border-radius: 10px;
  padding: 9px 14px;
}

.connect-whatsapp {
  border: 1px solid #128c7e;
  background: #128c7e;
  color: #fff;
  border-radius: 10px;
  padding: 9px 14px;
}

.error-banner {
  margin: 0 0 16px;
  border: 1px solid #ce4257;
  background: #ffeef0;
  color: #7a1526;
  border-radius: 10px;
  padding: 10px 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stats-grid article {
  background: #ffffff;
  border: 1px solid #c8ead9;
  border-radius: 14px;
  padding: 14px;
}

.stats-grid h2 {
  margin: 0;
  font-size: 2rem;
}

.stats-grid p {
  margin: 6px 0 0;
  color: #2f6a5e;
}

.workspace {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.inbox-panel,
.card {
  background: #fff;
  border: 1px solid #c8ead9;
  border-radius: 14px;
  padding: 14px;
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
  border: 1px solid #abd9c5;
  border-radius: 9px;
  padding: 8px 10px;
  background: #f7fffb;
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
  border: 1px solid #c8ead9;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  background: #f8fffc;
}

.conversation-list li.active {
  border-color: #25d366;
  background: #e7fff0;
}

.line1 {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.pill {
  font-size: 0.75rem;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid #97c8b6;
}

.pill[data-state="NEW"] {
  background: #e6f9ee;
  border-color: #58c791;
}

.pill[data-state="FOLLOW_UP"] {
  background: #ecfff2;
  border-color: #43bd80;
}

.pill[data-state="CLOSED"] {
  background: #eef7f3;
  border-color: #8eb8a9;
}

.dim {
  color: #4a6b61;
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
}

.meta-grid {
  display: grid;
  grid-template-columns: 180px 220px 1fr;
  gap: 10px;
  align-items: end;
  margin-bottom: 10px;
}

.messages {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow: auto;
  padding-right: 2px;
}

.message {
  border: 1px solid #c8ead9;
  border-radius: 11px;
  padding: 10px;
  background: #f7fffb;
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
  border: 1px solid #9fd4be;
  background: #f0fff7;
  border-radius: 8px;
  padding: 7px 11px;
  color: #0c5f52;
}

button.primary {
  border-color: #128c7e;
  background: #128c7e;
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
  border: 1px solid #c8ead9;
  border-radius: 10px;
  padding: 8px;
}

.inline-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.grid-2 {
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
  border: 1px solid #c8ead9;
  border-radius: 10px;
  padding: 8px;
}

.template-list p {
  margin: 6px 0;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 34, 28, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 50;
}

.modal-card {
  width: min(680px, 100%);
  background: #fff;
  border: 1px solid #bde3cf;
  border-radius: 16px;
  padding: 18px;
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
</style>
