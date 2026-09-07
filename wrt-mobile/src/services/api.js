// ============================================
// WRT Garage — API Client Service
// ============================================

const API_BASE_URL = typeof window !== 'undefined' && window.location 
  ? `http://${window.location.hostname}:3000/api` 
  : 'http://localhost:3000/api';

const API_KEY = 'wrt-garage-api-key-change-this-in-production';

export const apiClient = {
  baseUrl: API_BASE_URL,
  apiKey: API_KEY,

  async get(endpoint) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': API_KEY,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return res.json();
  },

  async post(endpoint, body) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    return res.json();
  },

  async checkHealth() {
    return this.get('/health');
  },

  async getDtcDatabase() {
    return this.get('/dtc-db');
  },

  async getDtcDetail(code) {
    return this.get(`/dtc-db/${code}`);
  },

  async getMotors() {
    return this.get('/motors');
  },

  async runDiagnosis(payload) {
    return this.post('/ai/diagnose', payload);
  },

  async chatAi(message, history = []) {
    return this.post('/ai/chat', { message, history });
  },

  async getSessions() {
    return this.get('/sessions');
  },

  async createSession(sessionData) {
    return this.post('/sessions', sessionData);
  },

  async submitFeedback(aiSessionId, score, note) {
    return this.post('/feedback', {
      ai_session_id: aiSessionId,
      score,
      note,
    });
  },
};

export default apiClient;
