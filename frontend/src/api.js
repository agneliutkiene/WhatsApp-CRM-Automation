const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    if (response.status === 401 && String(payload.error || "").toLowerCase().includes("authentication required")) {
      error.code = "AUTH_REQUIRED";
    }
    if (Array.isArray(payload.details)) {
      error.details = payload.details;
    }
    throw error;
  }

  return payload.data;
};

export const api = {
  getHealth: () => request("/health"),
  getAuthBootstrap: () => request("/auth/bootstrap"),
  getCurrentUser: () => request("/auth/me"),
  register: (body) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  login: (body) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  logout: () =>
    request("/auth/logout", {
      method: "POST"
    }),
  getAnalytics: () => request("/analytics/today"),
  getConversations: (query = "") => request(`/conversations${query}`),
  getConversation: (id) => request(`/conversations/${id}`),
  updateConversation: (id, body) =>
    request(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  addNote: (id, text) =>
    request(`/conversations/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  sendMessage: (id, body) =>
    request(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  getTemplates: () => request("/templates"),
  createTemplate: (body) =>
    request("/templates", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  updateTemplate: (id, body) =>
    request(`/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  getAutomation: () => request("/automation"),
  getAutomationSafety: () => request("/automation/safety"),
  updateAutomation: (body) =>
    request("/automation", {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  getWhatsAppConfig: () => request("/integrations/whatsapp/config"),
  getWhatsAppStatus: () => request("/integrations/whatsapp/status"),
  updateWhatsAppConfig: (body) =>
    request("/integrations/whatsapp/config", {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  confirmWhatsAppWebhook: () =>
    request("/integrations/whatsapp/confirm-webhook", {
      method: "POST"
    }),
  sendWhatsAppTestMessage: (body) =>
    request("/integrations/whatsapp/test-message", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  simulateInbound: (body) =>
    request("/conversations/ingest/inbound", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  pushWordPressLead: (body) =>
    request("/integrations/wordpress/lead", {
      method: "POST",
      body: JSON.stringify(body)
    })
};
