const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload.data;
};

export const api = {
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
  updateAutomation: (body) =>
    request("/automation", {
      method: "PATCH",
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
