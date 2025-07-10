require('dotenv').config();
const { Telegraf } = require('telegraf');
const authMiddleware = require('./middleware/authMiddleware');
const rateLimitMiddleware = require('./middleware/rateLimitMiddleware');
const MediaHandler = require('./handlers/mediaHandler');
const CommandHandler = require('./handlers/commandHandler');
const MessageHandler = require('./handlers/messageHandler');
const GroupService = require('./services/groupService');
const ForwardingService = require('./services/forwardingService');
const logger = require('./utils/logger');
const debug = require('./utils/debug');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware - order is important
// First check for channel posts and special cases in auth middleware
bot.use(authMiddleware);
// Then apply rate limiting
bot.use(rateLimitMiddleware);

// Initialize services
const groupService = new GroupService(bot);
const forwardingService = new ForwardingService(bot);

// Initialize handlers
const mediaHandler = new MediaHandler();
const commandHandler = new CommandHandler(groupService, forwardingService);
const messageHandler = new MessageHandler(groupService);

// Regular message handlers
bot.on('photo', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.on('document', (ctx) => mediaHandler.handleMediaUpload(ctx));
bot.command('start', (ctx) => commandHandler.handleStartCommand(ctx));
bot.command('help', (ctx) => commandHandler.handleHelpCommand(ctx));
bot.command('groups', (ctx) => commandHandler.handleGroupsCommand(ctx));
bot.command('channels', (ctx) => commandHandler.handleChannelsCommand(ctx));
bot.command('allchats', (ctx) => commandHandler.handleAllChatsCommand(ctx));
bot.command('adduser', (ctx) => commandHandler.handleAddUserCommand(ctx));
bot.command('whoami', (ctx) => commandHandler.handleWhoAmICommand(ctx));
bot.command('forwardmedia', (ctx) => commandHandler.handleForwardMediaCommand(ctx));
bot.on('text', (ctx) => messageHandler.handleTextMessage(ctx));

// Channel post handlers
bot.on('channel_post', async (ctx) => {
  const channelTitle = ctx.channelPost.chat.title || 'unnamed channel';
  const channelId = ctx.channelPost.chat.id;
  
  logger.info(`Processing channel post in "${channelTitle}" (${channelId})`);
  debug.logContext(ctx, 'Channel post details');
  
  try {
    // Handle commands in channels
    if (ctx.channelPost.text && ctx.channelPost.text.startsWith('/')) {
      const command = ctx.channelPost.text.split(' ')[0].substring(1);
      logger.info(`Channel command received: /${command}`);
      
      // Map commands to handlers
      const commandMap = {
        'help': () => commandHandler.handleHelpCommand(ctx),
        'groups': () => commandHandler.handleGroupsCommand(ctx),
        'channels': () => commandHandler.handleChannelsCommand(ctx),
        'allchats': () => commandHandler.handleAllChatsCommand(ctx),
        'start': () => commandHandler.handleStartCommand(ctx),
        'forwardmedia': () => commandHandler.handleForwardMediaCommand(ctx)
      };
      
      if (commandMap[command]) {
        logger.info(`Executing channel command: /${command}`);
        return await commandMap[command]();
      } else {
        logger.info(`Unknown channel command: /${command}`);
      }
    }
    
    // Handle media in channels
    if (ctx.channelPost.photo) {
      logger.info('Processing channel photo');
      return await mediaHandler.handleMediaUpload(ctx);
    } else if (ctx.channelPost.document) {
      logger.info('Processing channel document');
      return await mediaHandler.handleMediaUpload(ctx);
    } else if (ctx.channelPost.text) {
      logger.info(`Processing channel text: ${ctx.channelPost.text.substring(0, 30)}...`);
      // Use the text handler
      return await messageHandler.handleTextMessage(ctx);
    } else {
      logger.info('Channel post with unsupported content type');
    }
  } catch (error) {
    logger.error('Error processing channel post:', error);
  }
});

// Create middleware to track chats
bot.use((ctx, next) => {
  try {
    // Extract chat info from context and add to our tracker
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup' || ctx.chat.type === 'channel')) {
      logger.info(`Tracking chat: ${ctx.chat.title || 'Unnamed'} (${ctx.chat.id}), type: ${ctx.chat.type}`);
      groupService.addJoinedChat(ctx.chat);
    }
    
    // Also track chats from channel posts
    if (ctx.channelPost && ctx.channelPost.chat) {
      logger.info(`Tracking channel from post: ${ctx.channelPost.chat.title || 'Unnamed'} (${ctx.channelPost.chat.id})`);
      groupService.addJoinedChat(ctx.channelPost.chat);
    }
    
    // Track chats from updates
    if (ctx.update) {
      // Find any chat objects in the update
      const possibleChats = [
        ctx.update.message?.chat,
        ctx.update.channel_post?.chat,
        ctx.update.edited_message?.chat,
        ctx.update.callback_query?.message?.chat
      ].filter(chat => chat != null);
      
      for (const chat of possibleChats) {
        if (chat && (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel')) {
          logger.info(`Tracking chat from update: ${chat.title || 'Unnamed'} (${chat.id}), type: ${chat.type}`);
          groupService.addJoinedChat(chat);
        }
      }
    }
  } catch (error) {
    logger.error('Error in chat tracking middleware:', error);
  }
  
  return next();
});

// Add debug middleware for all updates
bot.use((ctx, next) => {
  // Debug log every incoming update
  debug.logContext(ctx, 'Incoming update');
  return next();
});

// Error handling
bot.catch((err, ctx) => {
  logger.error(`Encountered an error for ${ctx.updateType}:`, err);
  
  // Only reply to errors in private chats, not in channels/groups
  if (ctx.chat && ctx.chat.type === 'private') {
    ctx.reply('An error occurred while processing your request.')
      .catch(replyErr => {
        logger.error('Failed to send error message:', replyErr);
      });
  }
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

// Handle callback queries from inline keyboards
bot.on('callback_query', (ctx) => commandHandler.handleCallbackQuery(ctx));