const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

class MessageHandler {
  constructor(groupService) {
    this.groupService = groupService;
  }

  async handleTextMessage(ctx) {
    const text = ctx.message.text;

    // Basic command handling
    if (text.startsWith('/start')) {
      this.sendWelcomeMessage(ctx);
    } else if (text.startsWith('/help')) {
      this.sendHelpMessage(ctx);
    } else if (helpers.isTelegramInviteLink(text)) {
      // Process Telegram invitation link
      await this.handleGroupInviteLink(ctx, text);
    } else {
      this.handleUnknownMessage(ctx);
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
    ctx.reply(welcomeText);
  }

  sendHelpMessage(ctx) {
    const helpText = `Available commands:
/start - Start the bot
/help - Show this help message

You can also send me a Telegram group invitation link, and I'll automatically join that group!`;
    ctx.reply(helpText);
  }

  handleUnknownMessage(ctx) {
    const unknownText = "Sorry, I didn't understand that. Type /help for assistance.";
    ctx.reply(unknownText);
  }
}

module.exports = MessageHandler;