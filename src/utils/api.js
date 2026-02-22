const JSON_HEADERS = { "Content-Type": "application/json" };
const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1/dev-local-vault-route-29af4c8e71b5";

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
    return request(`${API_BASE}/credentials${query}`);
  },
  async createCredential(payload) {
    return request(`${API_BASE}/credentials`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async deleteCredential(id) {
    return request(`${API_BASE}/credentials/${id}`, { method: "DELETE" });
  },
  async clearCredentials() {
    return request(`${API_BASE}/credentials`, { method: "DELETE" });
  },
  async generatePassword(payload) {
    return request(`${API_BASE}/generate`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async createQrChallenge(payload) {
    return request(`${API_BASE}/qr/challenge`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async getQrChallengeStatus(id) {
    return request(`${API_BASE}/qr/challenge/${id}`);
  },
  async approveQr(payload) {
    return request(`${API_BASE}/qr/approve`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async listTrustedDevices() {
    return request(`${API_BASE}/devices`);
  },
  async registerDeviceKey(payload) {
    return request(`${API_BASE}/devices/register-key`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async listShareTargets() {
    return request(`${API_BASE}/devices/share-targets`);
  },
  async createCredentialSharePackage(payload) {
    return request(`${API_BASE}/share/credential`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async listAuditLogs(limit = 60) {
    return request(`${API_BASE}/audit?limit=${encodeURIComponent(limit)}`);
  },
  async generateHoneyPasswords(payload = { count: 3 }) {
    return request(`${API_BASE}/honey/generate`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async triggerHoneyAccess(payload) {
    return request(`${API_BASE}/honey/trigger`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    });
  },
  async checkCredentialBreach(id) {
    return request(`${API_BASE}/breach/check/${id}`, {
      method: "POST"
    });
  },
  async scanCredentialBreaches() {
    return request(`${API_BASE}/breach/scan`, {
      method: "POST"
    });
  }
};
