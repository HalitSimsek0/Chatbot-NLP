// ChatBot API Service
// Use relative path and let Vite dev proxy forward to backend
const API_BASE_URL = '/api';

class ChatService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Chat mesajı gönder
  async sendMessage(message, sessionId = null) {
    try {
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId || null,
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Chat API Error:', error);
      throw error;
    }
  }

  // Session listesi getir
  async listSessions() {
    const response = await fetch(`${this.baseURL}/chat/history`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Geçmiş sohbetleri getir
  async getChatHistory(sessionId) {
    const response = await fetch(`${this.baseURL}/chat/history/${sessionId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async deleteSession(sessionId) {
    const response = await fetch(`${this.baseURL}/chat/history/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // API durumunu kontrol et
  async checkApiStatus() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      console.error('API Status Check Error:', error);
      return false;
    }
  }

  // Yeni sohbet başlat
  async startNewChat() {
    return null;
  }

  // Session ID oluştur (fallback)
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

export default new ChatService();
