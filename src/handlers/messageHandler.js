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
    const isPrivateChat = !isChannelPost && ctx.chat && ctx.chat.type === 'private';
    const userId = ctx.from ? ctx.from.id : null;
    
    logger.info(`Processing ${isChannelPost ? 'channel post' : 'message'}: ${text.substring(0, 50)}`);

    if (isPrivateChat && userId) {
      const session = sessionManager.getSession(userId);
      const aiModeEnabled = session.aiAgentMode !== false;

      if (aiModeEnabled && !text.startsWith('/')) {
        return this.handleAiChatMessage(ctx, text, session);
      }
    }

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

  getDefaultAiHistory() {
    return [
      {
        role: 'system',
        content:
          'You are a helpful Telegram AI assistant. AI mode is primary. For analytics or sales requests, suggest using Help and AI Actions buttons when useful.'
      }
    ];
  }

  async handleAiChatMessage(ctx, text, session) {
    try {
      if (!this.aiAgentService) {
        return ctx.reply(
          'AI is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL in your environment.',
          KeyboardUtils.getPrimaryAiKeyboard()
        );
      }

      const userId = ctx.from.id;
      const history = Array.isArray(session.aiMessages) && session.aiMessages.length > 0
        ? session.aiMessages
        : this.getDefaultAiHistory();

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

      const responseWithHint = this.appendButtonHintIfNeeded(text, aiResponse);
      await this.replyInChunks(ctx, responseWithHint, KeyboardUtils.getPrimaryAiKeyboard());
    } catch (error) {
      logger.error('Error while handling AI chat message:', error);
      await ctx.reply(
        'AI request failed. Please try again in a moment.',
        KeyboardUtils.getPrimaryAiKeyboard()
      );
    }
  }

  appendButtonHintIfNeeded(userText, aiText) {
    const keywordRegex = /analytics|revenue|sales|kpi|dashboard|report/i;
    if (!keywordRegex.test(userText)) {
      return aiText;
    }

    const hint = '\n\nTip: tap Help & Options -> AI Actions for 24h/48h revenue and analytics quick actions.';
    if (aiText.includes('Help & Options') || aiText.includes('AI Actions')) {
      return aiText;
    }

    return `${aiText}${hint}`;
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
      if (ctx.from) {
        sessionManager.updateSession(ctx.from.id, {
          aiAgentMode: true,
          aiMessages: this.getDefaultAiHistory()
        });
      }

      const welcomeText = 'AI mode is active. Ask anything directly, or tap Help & Options for tools.';
      ctx.reply(welcomeText, KeyboardUtils.getPrimaryAiKeyboard());
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  sendHelpMessage(ctx) {
    try {
      const helpText = `📋 *Bot Help & Information*

This bot is focused on AI chat and analytics actions.

*AI-First Behavior:*
• AI mode is enabled by default in private chat
• Ask any question directly to the bot
• For analytics/revenue shortcuts, open AI Actions

*Main Features:*
• AI chat in private mode
• Analytics quick-action buttons
• Revenue shortcuts (24h, 48h, 7d)

*How to use:*
1. Ask the bot directly for AI responses
2. Open Help to access AI action buttons
3. Tap AI Actions for analytics cards

*Tip:* Use /start to return to AI Home anytime`;

      ctx.reply(helpText, { 
        parse_mode: 'Markdown',
        ...KeyboardUtils.getHelpOptionsKeyboard()
      });
    } catch (error) {
      logger.error('Error sending help message:', error);
    }
  }

  handleUnknownMessage(ctx) {
    try {
      const unknownText = "I can help with that. Ask directly, or tap Help & Options for available actions.";
      ctx.reply(unknownText, KeyboardUtils.getPrimaryAiKeyboard());
    } catch (error) {
      logger.error('Error sending unknown message response:', error);
    }
  }
}

module.exports = MessageHandler;