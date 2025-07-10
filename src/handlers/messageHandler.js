const helpers = require('../utils/helpers');
const logger = require('../utils/logger');
const KeyboardUtils = require('../utils/keyboards');

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
        this.processInviteLink(ctx, text);
      }
    } else {
      // For any other message, show the main menu (in private chats)
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
    try {
      const welcomeText = "Welcome to the Media Forwarding Bot! Use the buttons below to navigate:";
      ctx.reply(welcomeText, KeyboardUtils.getMainMenuKeyboard());
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  sendHelpMessage(ctx) {
    try {
      const helpText = `📋 *Bot Help & Information*

This bot helps you forward media between Telegram channels and groups.

*Main Features:*
• List joined groups and channels
• Forward media (photos, videos, documents) between channels
• Channel management
• User authentication

*How to use:*
1. Use the main menu buttons to navigate
2. For forwarding media, select source and target channels
3. Choose how many items to forward

*Tip:* Use /start to bring up the main menu anytime`;

      ctx.reply(helpText, { 
        parse_mode: 'Markdown',
        ...KeyboardUtils.getMainMenuKeyboard()
      });
    } catch (error) {
      logger.error('Error sending help message:', error);
    }
  }

  handleUnknownMessage(ctx) {
    try {
      const unknownText = "I'm not sure what you mean. Please use the menu buttons below:";
      ctx.reply(unknownText, KeyboardUtils.getMainMenuKeyboard());
    } catch (error) {
      logger.error('Error sending unknown message response:', error);
    }
  }
}

module.exports = MessageHandler;