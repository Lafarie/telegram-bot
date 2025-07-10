const logger = require('./logger');

/**
 * Debug utility to safely log Telegram context objects
 */
const debug = {
  /**
   * Safely log the structure of a Telegram context
   * @param {Object} ctx - Telegram context
   * @param {String} label - Optional label for the log
   */
  logContext: (ctx, label = 'Context') => {
    try {
      // Create a safe copy of the context to avoid circular references
      const safeCtx = {
        updateType: ctx.updateType,
        updateSubTypes: ctx.updateSubTypes,
        chat: ctx.chat ? {
          id: ctx.chat.id,
          type: ctx.chat.type,
          title: ctx.chat.title,
          username: ctx.chat.username
        } : null,
        from: ctx.from ? {
          id: ctx.from.id,
          username: ctx.from.username,
          is_bot: ctx.from.is_bot
        } : null,
        hasMessage: !!ctx.message,
        hasChannelPost: !!ctx.channelPost,
        hasCommand: ctx.message?.text?.startsWith('/') || ctx.channelPost?.text?.startsWith('/')
      };
      
      if (ctx.message) {
        safeCtx.messageType = getMessageType(ctx.message);
      }
      
      if (ctx.channelPost) {
        safeCtx.channelPostType = getMessageType(ctx.channelPost);
      }
      
      logger.info(`${label}:`, safeCtx);
    } catch (error) {
      logger.error('Error logging context:', error);
    }
  }
};

/**
 * Helper to determine message type
 */
function getMessageType(message) {
  if (!message) return 'unknown';
  if (message.text) return 'text';
  if (message.photo) return 'photo';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  if (message.video) return 'video';
  return 'other';
}

module.exports = debug;
