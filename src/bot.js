require('dotenv').config();
const { Telegraf } = require('telegraf');
const authMiddleware = require('./middleware/authMiddleware');
const rateLimitMiddleware = require('./middleware/rateLimitMiddleware');
const MediaHandler = require('./handlers/mediaHandler');
const CommandHandler = require('./handlers/commandHandler');
const MessageHandler = require('./handlers/messageHandler');
const GroupService = require('./services/groupService');
const logger = require('./utils/logger');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware
bot.use(authMiddleware);
bot.use(rateLimitMiddleware);

// Initialize services
const groupService = new GroupService(bot);

// Initialize handlers
const mediaHandler = new MediaHandler();
const commandHandler = new CommandHandler(groupService);
const messageHandler = new MessageHandler(groupService);

bot.on('photo', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.on('document', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.command('start', (ctx) => commandHandler.handleStartCommand(ctx));
bot.command('help', (ctx) => commandHandler.handleHelpCommand(ctx));
bot.command('groups', (ctx) => commandHandler.handleGroupsCommand(ctx));
bot.command('channels', (ctx) => commandHandler.handleChannelsCommand(ctx));
bot.command('allchats', (ctx) => commandHandler.handleAllChatsCommand(ctx));
bot.command('adduser', (ctx) => commandHandler.handleAddUserCommand(ctx));
bot.command('whoami', (ctx) => commandHandler.handleWhoAmICommand(ctx));
bot.on('text', (ctx) => messageHandler.handleTextMessage(ctx));

// Create middleware to track chats
bot.use((ctx, next) => {
  // Extract chat info from context and add to our tracker
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup' || ctx.chat.type === 'channel')) {
    groupService.addJoinedChat(ctx.chat);
  }
  return next();
});

// Error handling
bot.catch((err, ctx) => {
  logger.error(`Encountered an error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred while processing your request.');
});

// Start the bot
bot.launch()
  .then(() => {
    logger.info('Bot is up and running!');
    console.log('Bot is up and running!');
  })
  .catch((error) => {
    logger.error('Error launching the bot:', error);
    console.error('Error launching the bot:', error);
  });