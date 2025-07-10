const logger = require('../utils/logger');

module.exports = async (ctx, next) => {
  // Always allow /help and /start commands
  if (ctx.message && ctx.message.text && (
      ctx.message.text.startsWith('/help') || 
      ctx.message.text.startsWith('/start')
    )) {
    return next();
  }

  // Always allow callback queries (for interactive buttons)
  if (ctx.callbackQuery) {
    return next();
  }

  // Get the user ID from the Telegram context
  const userId = ctx.from ? ctx.from.id : null;
  const chatType = ctx.chat ? ctx.chat.type : 'private';
  const chatId = ctx.chat ? ctx.chat.id : null;
  
  // Optional: You can maintain a whitelist of authorized users in your .env file
  const authorizedUsers = process.env.AUTHORIZED_USERS ? 
    process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
    [];
  
  // Skip authentication for channel posts (the bot is already in the channel)
  if (ctx.channelPost) {
    logger.info(`Allowing channel post from: ${chatId}`);
    return next();
  }

  // For groups and supergroups, check if the user is an admin
  if (chatType === 'group' || chatType === 'supergroup') {
    try {
      // Check if the user is an admin of the group
      const chatMember = await ctx.telegram.getChatMember(chatId, userId);
      if (chatMember && ['creator', 'administrator'].includes(chatMember.status)) {
        logger.info(`Group admin access granted for user: ${userId} in chat: ${chatId}`);
        return next();
      }
    } catch (error) {
      logger.error(`Error checking admin status: ${error.message}`);
    }
  }

  // If no whitelist is defined, allow all users
  if (authorizedUsers.length === 0) {
    return next();
  }
  
  // Check if the user is in the whitelist
  if (!userId || !authorizedUsers.includes(userId)) {
    logger.warn(`Unauthorized access attempt from user: ${userId} in chat: ${chatId}`);
    return ctx.reply('You are not authorized to use this bot. Please contact the bot administrator for access.');
  }

  // User is authorized, proceed to next middleware
  logger.info(`Authorized access for user: ${userId} in chat: ${chatId}`);
  return next();
};