const logger = require('../utils/logger');

class AIAgentService {
  constructor(options = {}) {
    this.provider = (options.provider || process.env.AI_PROVIDER || 'openai-compatible').toLowerCase();
    this.baseUrl = (options.baseUrl || process.env.AI_BASE_URL || 'http://127.0.0.1:8045/v1').replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.AI_API_KEY || process.env.API_KEY || '';
    this.model = options.model || process.env.AI_MODEL || 'gemini-3-flash';
    this.fallbackModel = options.fallbackModel || process.env.AI_FALLBACK_MODEL || '';
    this.imageModel = options.imageModel || process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image';
    this.maxTokens = Number(options.maxTokens || process.env.AI_MAX_TOKENS || 1024);
    this.timeoutMs = Number(options.timeoutMs || process.env.AI_TIMEOUT_MS || 90000);
    this.retryOnTimeout = (options.retryOnTimeout ?? process.env.AI_RETRY_ON_TIMEOUT ?? 'true') === 'true';
    this.retryTimeoutMs = Number(options.retryTimeoutMs || process.env.AI_RETRY_TIMEOUT_MS || 120000);
  }

  async createChatCompletion(messages, userId) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('AI request requires at least one message.');
    }

    try {
      return await this.createChatCompletionWithRetry(messages, userId, this.model, this.timeoutMs);
    } catch (error) {
      if (this.shouldUseFallbackModel(error)) {
        logger.warn(`Primary model ${this.model} failed for user ${userId}. Falling back to ${this.fallbackModel}.`);
        return this.createChatCompletionWithRetry(messages, userId, this.fallbackModel, this.timeoutMs);
      }
      throw error;
    }
  }

  async createChatCompletionWithRetry(messages, userId, model, baseTimeoutMs) {
    try {
      return await this.createChatCompletionAttempt(messages, userId, model, baseTimeoutMs);
    } catch (error) {
      if (this.isAbortError(error) && this.retryOnTimeout) {
        logger.warn(`AI request timed out for user ${userId} on model ${model}. Retrying once with extended timeout.`);
        return this.createChatCompletionAttempt(messages, userId, model, this.retryTimeoutMs);
      }
      throw error;
    }
  }

  async createChatCompletionAttempt(messages, userId, model, timeoutMs) {
    const useTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0;
    const controller = new AbortController();
    const timeout = useTimeout ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = this.provider === 'anthropic'
        ? await this.sendAnthropicRequest(messages, controller.signal, model)
        : await this.sendOpenAICompatibleRequest(messages, controller.signal, model);

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error?.message || payload.message || `HTTP ${response.status}`;
        const error = new Error(`AI API request failed: ${message}`);
        error.httpStatus = response.status;
        error.apiMessage = message;
        throw error;
      }

      const content = this.provider === 'anthropic'
        ? this.parseAnthropicContent(payload)
        : this.parseOpenAICompatibleContent(payload);
      if (!content || typeof content !== 'string') {
        throw new Error('AI API returned an unexpected response format.');
      }

      return content.trim();
    } catch (error) {
      if (this.isAbortError(error)) {
        const seconds = Math.round((timeoutMs || 0) / 1000);
        throw new Error(`AI request timed out after ${seconds}s. Increase AI_TIMEOUT_MS or reduce prompt size.`);
      }
      logger.error(`AI request failed for user ${userId}:`, error);
      throw error;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  async sendOpenAICompatibleRequest(messages, signal, modelOverride) {
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
        model: modelOverride || this.model,
        messages,
        temperature: 0.6
      }),
      signal
    });
  }

  async sendAnthropicRequest(messages, signal, modelOverride) {
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
        model: modelOverride || this.model,
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

  parseOpenAICompatibleContent(payload) {
    const messageContent = payload?.choices?.[0]?.message?.content;

    if (typeof messageContent === 'string' && messageContent.trim()) {
      return messageContent.trim();
    }

    if (Array.isArray(messageContent)) {
      const extracted = messageContent
        .map(part => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();

      if (extracted) {
        return extracted;
      }
    }

    const choiceText = payload?.choices?.[0]?.text;
    if (typeof choiceText === 'string' && choiceText.trim()) {
      return choiceText.trim();
    }

    const outputText = payload?.output_text;
    if (typeof outputText === 'string' && outputText.trim()) {
      return outputText.trim();
    }

    // Fallback for Gemini-style payloads some gateways return.
    const geminiParts = payload?.candidates?.[0]?.content?.parts;
    if (Array.isArray(geminiParts)) {
      const geminiText = geminiParts
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      if (geminiText) {
        return geminiText;
      }
    }

    return null;
  }

  async generateImage(prompt, userId) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Image prompt is required.');
    }

    if (this.provider === 'anthropic') {
      throw new Error('Image generation is not configured for Anthropic provider in this bot. Use openai-compatible provider for image generation.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `${this.baseUrl}/images/generations`;
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
          model: this.imageModel,
          prompt
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.error?.message || payload.message || `HTTP ${response.status}`;
        throw new Error(`AI image request failed: ${message}`);
      }

      const first = payload.data?.[0];
      const imageUrl = first?.url;
      const b64Json = first?.b64_json;

      if (typeof imageUrl === 'string' && imageUrl.length > 0) {
        return { type: 'url', value: imageUrl };
      }

      if (typeof b64Json === 'string' && b64Json.length > 0) {
        return { type: 'base64', value: b64Json };
      }

      throw new Error('AI image API returned no image content.');
    } catch (error) {
      logger.error(`AI image generation failed for user ${userId}:`, error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  isAbortError(error) {
    return error && (error.name === 'AbortError' || /aborted|timeout/i.test(String(error.message || '')));
  }

  shouldUseFallbackModel(error) {
    if (!this.fallbackModel) return false;
    if (this.fallbackModel === this.model) return false;

    const message = String(error?.apiMessage || error?.message || '').toLowerCase();
    const status = Number(error?.httpStatus || 0);

    const serviceIssue = status === 503 || status === 502 || status === 429;
    const accountIssue =
      message.includes('all accounts failed') ||
      message.includes('unhealthy') ||
      message.includes('token error') ||
      message.includes('rate limit');

    return serviceIssue || accountIssue;
  }
}

module.exports = AIAgentService;
