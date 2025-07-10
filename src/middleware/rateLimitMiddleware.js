// A simple in-memory store for rate limiting
const userMessageCount = {};

/**
 * Telegram bot rate limiting middleware
 * Limits how many messages a user can send in a specific time window
 */
module.exports = (ctx, next) => {
  const userId = ctx.from.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxMessages = 10;     // Maximum 10 messages per minute
  
  // Initialize or clean up old records for this user
  if (!userMessageCount[userId]) {
    userMessageCount[userId] = [];
  }
  
  // Remove timestamps outside current window
  userMessageCount[userId] = userMessageCount[userId].filter(
    timestamp => now - timestamp < windowMs
  );
  
  // Check if user has exceeded rate limit
  if (userMessageCount[userId].length >= maxMessages) {
    return ctx.reply("You're sending too many messages. Please slow down.");
  }
  
  // Add current message timestamp
  userMessageCount[userId].push(now);
  
  // Call next middleware
  return next();
};