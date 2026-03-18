const helpers = require('../utils/helpers');
const logger = require('../utils/logger');
const KeyboardUtils = require('../utils/keyboards');
const sessionManager = require('../utils/sessionManager');

class MessageHandler {
  constructor(groupService, aiAgentService, googleSheetService, agentSoulService) {
    this.groupService = groupService;
    this.aiAgentService = aiAgentService;
    this.googleSheetService = googleSheetService;
    this.agentSoulService = agentSoulService;
    this.maxDataLoopTurns = Number(process.env.AI_DATA_LOOP_MAX_TURNS || 3);
    this.botName = process.env.BOT_NAME || 'Rush Ticketing Agent';
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

  getDefaultAiHistory(soulPrompt) {
    return [
      {
        role: 'system',
        content: soulPrompt
      }
    ];
  }

  async getAgentSoulPrompt() {
    if (this.agentSoulService && typeof this.agentSoulService.getSoulPrompt === 'function') {
      return this.agentSoulService.getSoulPrompt();
    }

    return [
      `You are ${this.botName}.`,
      'Help users with transaction details and relevant ticketing information.',
      'Ask for missing details when needed and do not invent data.'
    ].join('\n');
  }

  ensureSoulInHistory(history, soulPrompt) {
    if (!Array.isArray(history) || history.length === 0) {
      return this.getDefaultAiHistory(soulPrompt);
    }

    const cleaned = history.filter(item => item && typeof item.content === 'string');
    if (cleaned.length === 0) {
      return this.getDefaultAiHistory(soulPrompt);
    }

    const hasSystemAtTop = cleaned[0].role === 'system';
    if (hasSystemAtTop) {
      return [
        { role: 'system', content: soulPrompt },
        ...cleaned.slice(1)
      ];
    }

    return [
      { role: 'system', content: soulPrompt },
      ...cleaned
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
      const soulPrompt = await this.getAgentSoulPrompt();
      const history = this.ensureSoulInHistory(session.aiMessages, soulPrompt);

      const messages = [...history, { role: 'user', content: text }];

      await ctx.sendChatAction('typing');
      const aiResponse = await this.resolveAiResponseWithDataLoop(messages, userId);

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
      const isTimeout = /timed out|abort/i.test(String(error.message || ''));
      await ctx.reply(
        isTimeout
          ? 'AI request timed out while waiting for the model. Please retry, or increase AI_TIMEOUT_MS in .env.'
          : 'AI request failed. Please try again in a moment.',
        KeyboardUtils.getPrimaryAiKeyboard()
      );
    }
  }

  async resolveAiResponseWithDataLoop(baseMessages, userId) {
    const protocolInstruction = {
      role: 'system',
      content:
        'Before final answer, decide if extra external data is needed. ' +
        'Respond in strict JSON only. ' +
        'Use one of these formats:\n' +
        '{"status":"need_data","requests":[{"source":"google_sheet","detail":"what you need","params":{"transaction_id":"...","date":"YYYY-MM-DD","date_from":"...","date_to":"...","ticket_category":"...","currency":"...","payment_status":"...","min_total_price":0,"max_total_price":1000,"sort_by":"date","sort_order":"desc","limit":10,"fields":["transaction_id","date","total_price","currency"]}}]}\n' +
        '{"status":"final","answer":"your final answer"}\n' +
        'For google_sheet requests, params are required and must be relevant to the user question. ' +
        'If no extra data is required, return final immediately. ' +
        'Do not include markdown fences.'
    };

    const workMessages = [...baseMessages, protocolInstruction];
    let lastRawResponse = '';

    for (let turn = 0; turn < this.maxDataLoopTurns; turn += 1) {
      const raw = await this.aiAgentService.createChatCompletion(workMessages, userId);
      lastRawResponse = raw;

      const parsed = this.parseAgentControlJson(raw);
      if (!parsed) {
        return raw;
      }

      if (parsed.status === 'final') {
        const finalAnswer = (parsed.answer || '').toString().trim();
        return finalAnswer || raw;
      }

      if (parsed.status === 'need_data' && Array.isArray(parsed.requests)) {
        const fetchedDataText = await this.fulfillDataRequests(parsed.requests);

        workMessages.push({
          role: 'assistant',
          content: raw
        });

        workMessages.push({
          role: 'user',
          content:
            'Requested data results:\n' +
            `${fetchedDataText}\n\n` +
            'Now respond with strict JSON in final format.'
        });
        continue;
      }

      return raw;
    }

    return lastRawResponse || 'I could not finalize the answer in time.';
  }

  parseAgentControlJson(raw) {
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    const trimmed = raw.trim();

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      // Continue and try extracting JSON object from mixed text.
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }

    const jsonSlice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSlice);
    } catch (error) {
      return null;
    }
  }

  async fulfillDataRequests(requests) {
    const lines = [];

    for (const request of requests) {
      const source = (request?.source || '').toString().toLowerCase();
      const detail = (request?.detail || '').toString();

      if (source === 'google_sheet') {
        if (!this.googleSheetService || !this.googleSheetService.getConfigured()) {
          lines.push('google_sheet: unavailable (GOOGLE_SHEET_URL not configured).');
          continue;
        }

        const params = request?.params;
        if (!params || typeof params !== 'object' || Array.isArray(params)) {
          lines.push(
            'google_sheet: missing required params. Provide relevant filter params such as transaction_id, date/date_from/date_to, ticket_category, currency, payment_status, min_total_price/max_total_price, sort_by, sort_order, limit, fields.'
          );
          continue;
        }

        try {
          const context = await this.googleSheetService.getFilteredPromptContext(params);
          lines.push(`google_sheet detail: ${detail || 'none'}`);
          lines.push(`google_sheet params: ${JSON.stringify(params)}`);
          lines.push(context);
        } catch (error) {
          logger.error('Error fetching google_sheet in data loop:', error);
          lines.push(`google_sheet: fetch failed (${error.message})`);
        }
        continue;
      }

      lines.push(`${source || 'unknown_source'}: not supported by this bot.`);
    }

    return lines.join('\n\n');
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
    const maxMessages = 8;
    const maxContentLength = 1200;

    const systemMessages = messages
      .filter(msg => msg.role === 'system')
      .slice(0, 1)
      .map(msg => ({
        ...msg,
        content: (msg.content || '').toString().slice(0, maxContentLength)
      }));

    const nonSystemMessages = messages
      .filter(msg => msg.role !== 'system')
      .slice(-maxMessages)
      .map(msg => ({
        role: msg.role,
        content: (msg.content || '').toString().slice(0, maxContentLength)
      }));

    return [...systemMessages, ...nonSystemMessages];
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
        this.getAgentSoulPrompt()
          .then(soulPrompt => {
            sessionManager.updateSession(ctx.from.id, {
              aiAgentMode: true,
              aiMessages: this.getDefaultAiHistory(soulPrompt)
            });
          })
          .catch(error => {
            logger.warn(`Could not preload soul prompt for welcome session: ${error.message}`);
            sessionManager.updateSession(ctx.from.id, {
              aiAgentMode: true,
              aiMessages: this.getDefaultAiHistory(
                `You are ${this.botName}. Help users with transaction details and relevant ticketing information.`
              )
            });
          });
      }

      const welcomeText = `${this.botName} is active. Ask for transaction details, payments, ticket status, or tap Help & Options.`;
      ctx.reply(welcomeText, KeyboardUtils.getPrimaryAiKeyboard());
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  sendHelpMessage(ctx) {
    try {
      const helpText = `📋 *Bot Help & Information*

${this.botName} helps with transaction details, ticketing support, and analytics actions.

*AI-First Behavior:*
• AI mode is enabled by default in private chat
• Ask directly for transaction details, payment status, and ticket info
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