const logger = require('../utils/logger');

// A simple in-memory store for rate limiting
const userMessageCount = {};
const chatMessageCount = {};

/**
 * Telegram bot rate limiting middleware
 * Limits how many messages a user/chat can send in a specific time window
 */
module.exports = (ctx, next) => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxMessages = 10;     // Maximum 10 messages per minute
  
  // Skip rate limiting for channel posts
  if (ctx.channelPost) {
    logger.debug('Skipping rate limit for channel post');
    return next();
  }
  
  // For normal messages, use the user ID for rate limiting
  // For updates without a user ID, use chat ID instead
  let id;
  let isUser = false;
  
  if (ctx.from && ctx.from.id) {
    id = ctx.from.id;
    isUser = true;
  } else if (ctx.chat && ctx.chat.id) {
    id = ctx.chat.id;
  } else {
    // If we can't identify the source, just allow it
    logger.debug('Could not identify message source for rate limiting, allowing message');
    return next();
  }
  
  // Choose the appropriate rate limit store
  const store = isUser ? userMessageCount : chatMessageCount;
  
  // Initialize or clean up old records
  if (!store[id]) {
    store[id] = [];
  }
  
  // Remove timestamps outside current window
  store[id] = store[id].filter(
    timestamp => now - timestamp < windowMs
  );
  
  // Check if rate limit has been exceeded
  if (store[id].length >= maxMessages) {
    logger.warn(`Rate limit exceeded for ${isUser ? 'user' : 'chat'} ${id}`);
    return ctx.reply("You're sending too many messages. Please slow down.");
  }
  
  // Add current message timestamp
  store[id].push(now);
  
  // Call next middleware
  return next();
};