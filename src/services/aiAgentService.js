const logger = require('../utils/logger');

class AIAgentService {
  constructor(options = {}) {
    this.provider = (options.provider || process.env.AI_PROVIDER || 'openai-compatible').toLowerCase();
    this.baseUrl = (options.baseUrl || process.env.AI_BASE_URL || 'http://127.0.0.1:8045/v1').replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.AI_API_KEY || process.env.API_KEY || '';
    this.model = options.model || process.env.AI_MODEL || 'gemini-3-flash';
    this.maxTokens = Number(options.maxTokens || process.env.AI_MAX_TOKENS || 1024);
    this.timeoutMs = Number(options.timeoutMs || process.env.AI_TIMEOUT_MS || 30000);
  }

  async createChatCompletion(messages, userId) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('AI request requires at least one message.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = this.provider === 'anthropic'
        ? await this.sendAnthropicRequest(messages, controller.signal)
        : await this.sendOpenAICompatibleRequest(messages, controller.signal);

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error?.message || payload.message || `HTTP ${response.status}`;
        throw new Error(`AI API request failed: ${message}`);
      }

      const content = this.provider === 'anthropic'
        ? this.parseAnthropicContent(payload)
        : payload.choices?.[0]?.message?.content;
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

  async sendOpenAICompatibleRequest(messages, signal) {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.6
      }),
      signal
    });
  }

  async sendAnthropicRequest(messages, signal) {
    const endpoint = `${this.baseUrl}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };

    const system = messages
      .filter(msg => msg.role === 'system')
      .map(msg => msg.content)
      .join('\n\n');

    const nonSystemMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({ role: msg.role, content: msg.content }));

    return fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        system,
        max_tokens: this.maxTokens,
        messages: nonSystemMessages
      }),
      signal
    });
  }

  parseAnthropicContent(payload) {
    const content = payload.content;
    if (!Array.isArray(content) || content.length === 0) {
      return null;
    }

    const textBlocks = content
      .filter(item => item && item.type === 'text' && typeof item.text === 'string')
      .map(item => item.text);

    if (textBlocks.length === 0) {
      return null;
    }

    return textBlocks.join('\n').trim();
  }
}

module.exports = AIAgentService;
