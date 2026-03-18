const helpers = require('../utils/helpers');
const logger = require('../utils/logger');
const KeyboardUtils = require('../utils/keyboards');
const sessionManager = require('../utils/sessionManager');

class MessageHandler {
  constructor(groupService, aiAgentService) {
    this.groupService = groupService;
    this.aiAgentService = aiAgentService;
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
    const isPrivateChat = ctx.chat && ctx.chat.type === 'private';
    const userId = ctx.from ? ctx.from.id : null;

    if (!isChannelPost && isPrivateChat && userId) {
      const session = sessionManager.getSession(userId);
      if (session.aiAgentMode && !text.startsWith('/')) {
        return this.handleAiAgentMessage(ctx, text, session);
      }
    }
    
    logger.info(`Processing ${isChannelPost ? 'channel post' : 'message'}: ${text.substring(0, 50)}`);

    // Basic command handling
    if (text.startsWith('/start')) {
      this.sendWelcomeMessage(ctx);
    } else if (text.startsWith('/help')) {
      this.sendHelpMessage(ctx);
    } else if (/^\/agentoff(?:\s|$)/.test(text) && isPrivateChat && userId) {
      sessionManager.updateSession(userId, {
        aiAgentMode: false,
        aiMessages: []
      });
      ctx.reply('AI mode disabled.', KeyboardUtils.getMainMenuKeyboard());
    } else if (/^\/agent(?:\s|$)/.test(text) && isPrivateChat && userId) {
      sessionManager.updateSession(userId, {
        aiAgentMode: true,
        aiMessages: [
          {
            role: 'system',
            content: 'You are a helpful Telegram assistant. Keep answers concise, clear, and practical.'
          }
        ]
      });
      ctx.reply(
        '🤖 AI mode enabled. Send any text to chat with the AI.',
        KeyboardUtils.getAiAgentKeyboard()
      );
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

  async handleAiAgentMessage(ctx, text, session) {
    try {
      if (!this.aiAgentService) {
        return ctx.reply('AI service is not configured on this bot instance.');
      }

      const userId = ctx.from.id;
      const history = Array.isArray(session.aiMessages) ? session.aiMessages : [];
      const messages = [...history, { role: 'user', content: text }];

      await ctx.sendChatAction('typing');
      const aiResponse = await this.aiAgentService.createChatCompletion(messages, userId);

      const updatedHistory = this.limitConversationHistory([
        ...messages,
        { role: 'assistant', content: aiResponse }
      ]);

      sessionManager.updateSession(userId, {
        aiAgentMode: true,
        aiMessages: updatedHistory
      });

      await this.replyInChunks(ctx, aiResponse, KeyboardUtils.getAiAgentKeyboard());
    } catch (error) {
      logger.error('Error while processing AI message:', error);
      await ctx.reply(
        'AI request failed. Check `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in your environment.',
        KeyboardUtils.getAiAgentKeyboard()
      );
    }
  }

  limitConversationHistory(messages) {
    const systemMessages = messages.filter(msg => msg.role === 'system').slice(0, 1);
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    const maxMessages = 16;
    const trimmed = nonSystemMessages.slice(-maxMessages);
    return [...systemMessages, ...trimmed];
  }

  async replyInChunks(ctx, text, keyboard) {
    const chunkSize = 3800;
    const safeText = text || '';
    const chunks = [];

    for (let i = 0; i < safeText.length; i += chunkSize) {
      chunks.push(safeText.slice(i, i + chunkSize));
    }

    if (chunks.length === 0) {
      return ctx.reply('(empty response)', keyboard);
    }

    for (let i = 0; i < chunks.length; i += 1) {
      if (i === chunks.length - 1) {
        await ctx.reply(chunks[i], keyboard);
      } else {
        await ctx.reply(chunks[i]);
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