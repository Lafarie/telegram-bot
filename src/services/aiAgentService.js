const logger = require('../utils/logger');

class AIAgentService {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.AI_BASE_URL || 'http://127.0.0.1:8045/v1').replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.AI_API_KEY || process.env.API_KEY || '';
    this.model = options.model || process.env.AI_MODEL || 'gemini-3-flash';
    this.timeoutMs = Number(options.timeoutMs || process.env.AI_TIMEOUT_MS || 30000);
  }

  async createChatCompletion(messages, userId) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('AI request requires at least one message.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `${this.baseUrl}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.6
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error?.message || payload.message || `HTTP ${response.status}`;
        throw new Error(`AI API request failed: ${message}`);
      }

      const content = payload.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('AI API returned an unexpected response format.');
      }

      return content.trim();
    } catch (error) {
      logger.error(`AI request failed for user ${userId}:`, error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = AIAgentService;
