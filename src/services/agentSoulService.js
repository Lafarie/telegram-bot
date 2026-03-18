const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

class AgentSoulService {
  constructor(options = {}) {
    this.soulPath = options.soulPath || path.join(__dirname, '../prompts/soul.md');
    this.cachedSoul = null;
    this.botName = options.botName || process.env.BOT_NAME || 'Rush Ticketing Agent';
  }

  async getSoulPrompt() {
    if (this.cachedSoul) {
      return this.cachedSoul;
    }

    try {
      const soul = await fs.readFile(this.soulPath, 'utf8');
      const trimmed = soul.trim();
      this.cachedSoul = trimmed || this.getFallbackSoulPrompt();
      return this.cachedSoul;
    } catch (error) {
      logger.warn(`Could not load soul prompt at ${this.soulPath}: ${error.message}`);
      this.cachedSoul = this.getFallbackSoulPrompt();
      return this.cachedSoul;
    }
  }

  getFallbackSoulPrompt() {
    return [
      `You are ${this.botName}.`,
      'You are a ticketing support AI focused on transaction details and relevant order information.',
      'Help users with transaction lookup, payment status, ticket details, and next steps.',
      'Ask for missing details when needed (transaction ID, date range, payment status, amount).',
      'Do not invent values. If data is missing, say what is missing and what the user should provide.',
      'Use clear plain text suitable for Telegram.'
    ].join('\n');
  }
}

module.exports = AgentSoulService;