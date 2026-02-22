const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unexpected API error");
  return data;
}

export const api = {
  async listCredentials(q = "") {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return request(`/api/credentials${query}`);
  },
  async createCredential(payload) {
    return request("/api/credentials", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async deleteCredential(id) {
    return request(`/api/credentials/${id}`, { method: "DELETE" });
  },
  async clearCredentials() {
    return request("/api/credentials", { method: "DELETE" });
  },
  async generatePassword(payload) {
    return request("/api/generate", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  }
};
