const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

class MessageHandler {
  constructor(groupService) {
    this.groupService = groupService;
  }

  async handleTextMessage(ctx) {
    // Handle both regular messages and channel posts
    const message = ctx.message || ctx.channelPost;
    
    if (!message || !message.text) {
      logger.warn('Received message without text content');
      return;
    }
    
    const text = message.text;
    const isChannelPost = !!ctx.channelPost;
    
    logger.info(`Processing ${isChannelPost ? 'channel post' : 'message'}: ${text.substring(0, 50)}`);

    // Basic command handling
    if (text.startsWith('/start')) {
      this.sendWelcomeMessage(ctx);
    } else if (text.startsWith('/help')) {
      this.sendHelpMessage(ctx);
    } else if (helpers.isTelegramInviteLink(text)) {
      // Process Telegram invitation link - not for channel posts
      if (!isChannelPost) {
        await this.handleGroupInviteLink(ctx, text);
      }
    } else {
      // Only respond to unknown messages in private chats
      if (!isChannelPost && ctx.chat.type === 'private') {
        this.handleUnknownMessage(ctx);
      }
    }
  }
  
  async handleGroupInviteLink(ctx, inviteLink) {
    await ctx.reply(`I detected a Telegram group invitation link. Attempting to join...`);
    
    try {
      const success = await this.groupService.joinGroup(inviteLink);
      
      if (success) {
        await ctx.reply('✅ Successfully joined the group!');
      } else {
        await ctx.reply('❌ Failed to join the group. Please check if the link is valid and the bot has permission to join groups.');
      }
    } catch (error) {
      logger.error('Error joining group:', error);
      await ctx.reply('An error occurred while trying to join the group.');
    }
  }

  sendWelcomeMessage(ctx) {
    const welcomeText = "Welcome to the bot! Use /help to see available commands.";
    try {
      ctx.reply(welcomeText);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  sendHelpMessage(ctx) {
    const helpText = `📋 *Available commands:*

*Basic Commands:*
/start - Welcome message
/help - List of commands
/whoami - Show your user ID and information

*Group & Channel Management:*
/groups - List all groups I've joined
/channels - List all channels I've joined
/allchats - List all groups and channels I've joined

You can also send me a Telegram group invitation link, and I'll automatically join that group!`;

    try {
      ctx.reply(helpText, { parse_mode: 'Markdown' });
    } catch (error) {
      // Try without markdown if it fails
      logger.error('Error sending help message with markdown:', error);
      ctx.reply(helpText.replace(/\*/g, ''));
    }
  }

  handleUnknownMessage(ctx) {
    const unknownText = "Sorry, I didn't understand that. Type /help for assistance.";
    try {
      ctx.reply(unknownText);
    } catch (error) {
      logger.error('Error sending unknown message response:', error);
    }
  }
}

module.exports = MessageHandler;