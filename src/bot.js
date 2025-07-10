require('dotenv').config();
const { Telegraf } = require('telegraf');
const authMiddleware = require('./middleware/authMiddleware');
const rateLimitMiddleware = require('./middleware/rateLimitMiddleware');
const MediaHandler = require('./handlers/mediaHandler');
const CommandHandler = require('./handlers/commandHandler');
const MessageHandler = require('./handlers/messageHandler');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware
bot.use(authMiddleware);
bot.use(rateLimitMiddleware);

// Handlers
const mediaHandler = new MediaHandler();
const commandHandler = new CommandHandler();
const messageHandler = new MessageHandler();

bot.on('photo', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.on('document', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.command('start', (ctx) => commandHandler.handleStartCommand(ctx));
bot.command('help', (ctx) => commandHandler.handleHelpCommand(ctx));
bot.on('text', (ctx) => messageHandler.handleTextMessage(ctx));

// Start the bot
bot.launch()
  .then(() => {
    console.log('Bot is up and running!');
  })
  .catch((error) => {
    console.error('Error launching the bot:', error);
  });