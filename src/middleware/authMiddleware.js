module.exports = (ctx, next) => {
  // Get the user ID from the Telegram context
  const userId = ctx.from ? ctx.from.id : null;
  
  // Optional: You can maintain a whitelist of authorized users in your .env file
  const authorizedUsers = process.env.AUTHORIZED_USERS ? 
    process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
    [];
  
  if (!userId || (authorizedUsers.length > 0 && !authorizedUsers.includes(userId))) {
    // For unauthorized users, you can either ignore their message or reply with a message
    return ctx.reply('You are not authorized to use this bot.');
  }

  // User is authorized, proceed to next middleware
  return next();
};