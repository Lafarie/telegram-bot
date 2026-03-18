const logger = require('../utils/logger');
const KeyboardUtils = require('../utils/keyboards');
const sessionManager = require('../utils/sessionManager');
const fs = require('fs/promises');
const path = require('path');

class CommandHandler {
    constructor(groupService, forwardingService, aiAgentService, googleSheetService) {
        this.groupService = groupService;
        this.forwardingService = forwardingService;
        this.aiAgentService = aiAgentService;
        this.googleSheetService = googleSheetService;
        this.analyticsOutputInstructionPath = path.join(__dirname, '../prompts/analytics-output.instructions.md');
        this.analyticsImageInstructionPath = path.join(__dirname, '../prompts/analytics-image-output.instructions.md');
        this.instructionCache = new Map();
    }

    async handleStartCommand(ctx) {
        try {
            if (ctx.from) {
                sessionManager.updateSession(ctx.from.id, {
                    aiAgentMode: true,
                    aiMessages: this.getDefaultAiSystemMessages()
                });
            }

            const message = "AI mode is active by default. Ask anything, or use Help for more options.";
            logger.info('Sending start command with AI-first menu');
            
            // Show main menu with inline keyboard
            await ctx.reply(message, KeyboardUtils.getMainMenuKeyboard());
            logger.info('Start command response sent successfully');
        } catch (error) {
            logger.error('Error sending start command response:', error);
        }
    }

    async handleHelpCommand(ctx, fromCallback = false) {
        const message = `📋 *Bot Help & Information*

This bot is focused on AI chat and analytics actions.

*AI-First Behavior:*
• AI mode is enabled by default in private chat
• Ask any question directly and get AI response
• Use AI Actions for analytics and revenue shortcuts

*Main Features:*
• AI chat in private mode
• Analytics quick-action buttons
• Revenue shortcuts (24h, 48h, 7d)

*How to use:*
1. Ask the bot directly for AI responses
2. Open Help to access AI action buttons
3. Tap AI Actions for quick analytics cards

*Tip:* Use /start to go back to AI Home anytime`;

        try {
            logger.info('Sending help command response');
            const options = { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getHelpOptionsKeyboard()
            };

            if (fromCallback) {
                await ctx.editMessageText(message, options);
            } else {
                await ctx.reply(message, options);
            }

            logger.info('Help command response sent successfully');
        } catch (error) {
            logger.error('Error sending help command response:', error);
            // Try without markdown
            try {
                const plainMessage = message.replace(/\*/g, '');
                if (fromCallback) {
                    await ctx.editMessageText(plainMessage, KeyboardUtils.getHelpOptionsKeyboard());
                } else {
                    await ctx.reply(plainMessage, KeyboardUtils.getHelpOptionsKeyboard());
                }
            } catch (secondError) {
                logger.error('Error sending plain help message:', secondError);
            }
        }
    }
    
    // Handle callback queries from inline keyboards
    async handleCallbackQuery(ctx) {
        try {
            const callbackData = ctx.callbackQuery.data;
            const userId = ctx.from.id;
            
            logger.info(`Received callback: ${callbackData} from user: ${userId}`);
            
            // Acknowledge the callback to remove loading state
            await ctx.answerCbQuery();
            
            // Handle different callback types
            if (callbackData === 'cmd_main_menu') {
                return this.handleMainMenu(ctx);
            } else if (callbackData === 'cmd_ai_home') {
                return this.handleAiHome(ctx);
            } else if (callbackData === 'cmd_ai_actions') {
                return this.handleAiActionsMenu(ctx);
            } else if (callbackData === 'cmd_help') {
                return this.handleHelpCommand(ctx, true);
            } 

            else if (callbackData.startsWith('ai_')) {
                return this.handleAiAnalyticsAction(ctx, callbackData);
            }
            
            // Handle source channel selection
            else if (callbackData.startsWith('src_channel_')) {
                const sourceChannelId = Number(callbackData.replace('src_channel_', ''));
                return this.handleSourceChannelSelected(ctx, sourceChannelId);
            }
            
            // Handle target channel selection
            else if (callbackData.startsWith('tgt_channel_')) {
                const targetChannelId = Number(callbackData.replace('tgt_channel_', ''));
                const session = sessionManager.getSession(userId);
                return this.handleTargetChannelSelected(ctx, session.sourceChannelId, targetChannelId);
            }
            
            // Handle limit selection and start forwarding
            else if (callbackData.startsWith('fwd_')) {
                const parts = callbackData.split('_');
                if (parts.length === 4) {
                    const sourceChannelId = Number(parts[1]);
                    const targetChannelId = Number(parts[2]);
                    const limit = Number(parts[3]);
                    return this.executeForwardMedia(ctx, sourceChannelId, targetChannelId, limit);
                }
            }
            
            // Unknown callback
            logger.warn(`Unknown callback data: ${callbackData}`);
            return ctx.reply('Unknown command. Use /start to restart.', KeyboardUtils.getMainMenuKeyboard());
            
        } catch (error) {
            logger.error('Error handling callback query:', error);
            await ctx.reply('An error occurred while processing your request.');
        }
    }
    
    async handleMainMenu(ctx) {
        try {
            const message = "AI Home - ask your question directly or open Help/AI Actions:";
            await ctx.editMessageText(message, KeyboardUtils.getMainMenuKeyboard());
        } catch (error) {
            logger.error('Error sending main menu:', error);
            // If we can't edit, send a new message
            try {
                await ctx.reply("AI Home - ask your question directly or open Help/AI Actions:", KeyboardUtils.getMainMenuKeyboard());
            } catch (replyError) {
                logger.error('Error sending main menu as new message:', replyError);
            }
        }
    }

    async handleAiHome(ctx) {
        return this.handleMainMenu(ctx);
    }

    async handleAiActionsMenu(ctx) {
        const message =
            '📊 *AI Actions*\n\n' +
            'Use these buttons for analytics and revenue snapshots.\n' +
            'You can still ask free-text questions anytime.';

        const options = {
            parse_mode: 'Markdown',
            ...KeyboardUtils.getAiActionsKeyboard()
        };

        try {
            return ctx.editMessageText(message, options);
        } catch (error) {
            logger.error('Error sending AI actions menu:', error);
            return ctx.reply(message, options);
        }
    }

    async handleAiAnalyticsAction(ctx, action) {
        try {
            const actionPrompts = {
                ai_analytics_all: 'Provide a complete business analytics snapshot including sales, orders, trend direction, and top opportunities.',
                ai_revenue_24h: 'Provide sales revenue insight for the last 24 hours with key drivers and short recommendation.',
                ai_revenue_48h: 'Provide sales revenue insight for the last 48 hours, compare first 24h vs second 24h, and suggest actions.',
                ai_revenue_7d: 'Provide a 7-day sales revenue summary with trend highlights and next-step recommendation.',
                ai_top_products: 'List top performing products and explain why they are performing best.',
                ai_orders_summary: 'Provide an orders summary with useful operational insights.',
                ai_conversion: 'Provide a conversion report summary and suggest optimization steps.',
                ai_kpi_refresh: 'Provide a refreshed KPI snapshot for revenue, orders, and conversion indicators.',
                ai_analytics_image: 'Create an analytics image summary from spreadsheet data.'
            };

            const prompt = actionPrompts[action] || 'Provide a concise business analytics summary.';
            let content;
            const requiresSheetData = action.startsWith('ai_');

            if (this.aiAgentService) {
                const userId = ctx.from ? ctx.from.id : 'unknown';
                const sheetData = await this.getGoogleSheetContextForAnalytics();

                if (requiresSheetData && !sheetData.ok) {
                    const sheetErrorMessage =
                        `Could not read Google Sheet data for this analytics action.\n\n` +
                        `Reason: ${sheetData.error}\n\n` +
                        'Please verify GOOGLE_SHEET_URL and sheet sharing permissions, then try again.';
                    return ctx.editMessageText(sheetErrorMessage, KeyboardUtils.getAiActionsKeyboard());
                }

                if (action === 'ai_analytics_image') {
                    return this.sendAnalyticsImage(ctx, sheetData.table);
                }

                const analyticsOutputInstructions = await this.getInstructionContent(
                    this.analyticsOutputInstructionPath,
                    this.getDefaultAnalyticsOutputInstructions()
                );

                const messages = [
                    {
                        role: 'system',
                        content:
                            'You are a business analytics assistant. Use ONLY provided spreadsheet data for metrics and conclusions. ' +
                            'Always reference which columns/fields were used. If data is missing, say exactly what is missing.\n\n' +
                            'Output instructions:\n' +
                            analyticsOutputInstructions
                    },
                    {
                        role: 'user',
                        content:
                            `${prompt}\n\n` +
                            'Data source requirement: respond based on Google Sheet context below.\n' +
                            'Output format:\n' +
                            '1) Key metrics\n' +
                            '2) Short explanation\n' +
                            '3) Data references (column names)\n\n' +
                            `${sheetData.context}`
                    }
                ];
                content = await this.aiAgentService.createChatCompletion(messages, userId);
            } else {
                content = 'AI service is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL to enable analytics actions.';
            }

            return ctx.editMessageText(content, KeyboardUtils.getAiActionsKeyboard());
        } catch (error) {
            logger.error('Error handling AI analytics action:', error);
            return ctx.editMessageText(
                'Could not complete this analytics action right now. Please try again.',
                KeyboardUtils.getAiActionsKeyboard()
            );
        }
    }

    async getGoogleSheetContextForAnalytics() {
        if (!this.googleSheetService || !this.googleSheetService.getConfigured()) {
            return {
                ok: false,
                error: 'Spreadsheet data is not configured. Set GOOGLE_SHEET_URL in the environment.',
                context: '',
                table: null
            };
        }

        try {
            const table = await this.googleSheetService.getTabularData();
            const context = await this.googleSheetService.getPromptContext();
            return {
                ok: true,
                error: null,
                context,
                table
            };
        } catch (error) {
            logger.error('Error fetching Google Sheet analytics context:', error);
            return {
                ok: false,
                error: `Spreadsheet data could not be fetched: ${error.message}`,
                context: '',
                table: null
            };
        }
    }

    async sendAnalyticsImage(ctx, table) {
        try {
            const series = this.extractChartSeries(table);
            const imageOutputInstructions = await this.getInstructionContent(
                this.analyticsImageInstructionPath,
                this.getDefaultAnalyticsImageInstructions()
            );
            const imagePrompt = this.buildAnalyticsImagePrompt(series, imageOutputInstructions);
            const userId = ctx.from ? ctx.from.id : 'unknown';

            if (!this.aiAgentService) {
                throw new Error('AI service is not configured.');
            }

            const generatedImage = await this.aiAgentService.generateImage(imagePrompt, userId);
            const photoSource = generatedImage.type === 'base64'
                ? { source: Buffer.from(generatedImage.value, 'base64') }
                : generatedImage.value;

            await ctx.replyWithPhoto(photoSource, {
                caption: `📊 Analytics image generated from Google Sheet\nMetric: ${series.metricLabel}\nPoints: ${series.values.length}`,
                ...KeyboardUtils.getAiActionsKeyboard()
            });

            try {
                return await ctx.editMessageText('Analytics image sent below.', KeyboardUtils.getAiActionsKeyboard());
            } catch (error) {
                return null;
            }
        } catch (error) {
            logger.error('Error generating analytics image:', error);
            return ctx.editMessageText(
                `Could not generate analytics image: ${error.message}`,
                KeyboardUtils.getAiActionsKeyboard()
            );
        }
    }

    buildAnalyticsImagePrompt(series, imageInstructions) {
        const labelsLine = series.labels.join(' | ');
        const valuesLine = series.values.join(' | ');

        return [
            'Generate a clean analytics dashboard image for a Telegram business report.',
            `Primary metric: ${series.metricLabel}`,
            `Labels: ${labelsLine}`,
            `Values: ${valuesLine}`,
            'Style requirements:',
            '- Modern white background, blue accent charts, clear typography',
            '- Include a line chart and concise KPI summary cards',
            '- Show trend direction based on provided values',
            '- Keep layout readable on mobile',
            '',
            'Additional output instructions:',
            imageInstructions
        ].join('\n');
    }

    async getInstructionContent(filePath, fallback) {
        const cached = this.instructionCache.get(filePath);
        if (cached) {
            return cached;
        }

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const trimmed = content.trim();
            const finalContent = trimmed || fallback;
            this.instructionCache.set(filePath, finalContent);
            return finalContent;
        } catch (error) {
            logger.warn(`Could not load instruction file ${filePath}: ${error.message}`);
            this.instructionCache.set(filePath, fallback);
            return fallback;
        }
    }

    getDefaultAnalyticsOutputInstructions() {
        return [
            'Format: Snapshot, Key Metrics, Insights, References, Actions.',
            'Use only provided data; do not invent values.',
            'If missing values exist, explicitly call them out.'
        ].join('\n');
    }

    getDefaultAnalyticsImageInstructions() {
        return [
            'Generate a single mobile-friendly dashboard image.',
            'Use only provided labels and values.',
            'Include chart plus concise KPI cards.'
        ].join('\n');
    }

    extractChartSeries(table) {
        if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
            throw new Error('No tabular data available.');
        }

        const headers = table.headers;
        const rows = table.rows.filter(row => Array.isArray(row));
        if (headers.length === 0 || rows.length === 0) {
            throw new Error('Spreadsheet has no usable rows.');
        }

        const numericIndex = this.findNumericColumnIndex(headers, rows);
        if (numericIndex < 0) {
            throw new Error('Could not find a numeric metric column in sheet data.');
        }

        const labelIndex = this.findLabelColumnIndex(headers, numericIndex);
        const metricLabel = headers[numericIndex] || 'Metric';

        const points = [];
        for (const row of rows) {
            const value = this.toNumber(row[numericIndex]);
            if (value === null) continue;
            const label = (row[labelIndex] || '').toString().trim() || `Row ${points.length + 1}`;
            points.push({ label, value });
        }

        if (points.length === 0) {
            throw new Error('No numeric values found in selected metric column.');
        }

        const trimmed = points.slice(-12);
        return {
            metricLabel,
            labels: trimmed.map(p => p.label),
            values: trimmed.map(p => p.value)
        };
    }

    findNumericColumnIndex(headers, rows) {
        let bestIndex = -1;
        let bestScore = -1;

        for (let i = 0; i < headers.length; i += 1) {
            const values = rows.map(row => this.toNumber(row[i])).filter(v => v !== null);
            const score = values.length;
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestScore > 0 ? bestIndex : -1;
    }

    findLabelColumnIndex(headers, numericIndex) {
        const dateLikeIndex = headers.findIndex((header, idx) => idx !== numericIndex && /date|day|time|period/i.test((header || '').toString()));
        if (dateLikeIndex >= 0) return dateLikeIndex;
        return numericIndex === 0 ? 1 : 0;
    }

    toNumber(value) {
        if (value === null || value === undefined) return null;
        const normalized = value.toString().replace(/[$,%\s,]/g, '');
        if (!normalized) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    getDefaultAiSystemMessages() {
        return [
            {
                role: 'system',
                content:
                    'You are a helpful Telegram AI assistant. Default to AI chat. Mention buttons only when they can help, especially Help and AI Actions for analytics tasks.'
            }
        ];
    }
    
    async handleGroupsCommand(ctx, fromCallback = false) {
        try {
            const chats = await this.groupService.getJoinedChats(ctx);
            const groups = [...chats.groups, ...chats.supergroups];
            
            if (groups.length === 0) {
                const message = "I haven't joined any groups yet.";
                
                if (fromCallback) {
                    return ctx.editMessageText(message, KeyboardUtils.getBackKeyboard());
                }
                return ctx.reply(message, KeyboardUtils.getBackKeyboard());
            }
            
            let message = "📋 *Groups I've joined:*\n\n";
            
            groups.forEach((group, index) => {
                message += `${index + 1}. *${group.title}*\n`;
                if (group.username) message += `   @${group.username}\n`;
                message += `   Type: ${group.type}\n`;
                message += `   ID: \`${group.id}\`\n\n`;
            });
            
            const options = { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getBackKeyboard()
            };
            
            if (fromCallback) {
                return ctx.editMessageText(message, options);
            }
            return ctx.reply(message, options);
        } catch (error) {
            logger.error('Error listing groups:', error);
            const errorMessage = "Sorry, I encountered an error while listing the groups.";
            
            if (fromCallback) {
                return ctx.editMessageText(errorMessage, KeyboardUtils.getBackKeyboard());
            }
            return ctx.reply(errorMessage, KeyboardUtils.getBackKeyboard());
        }
    }
    
    async handleChannelsCommand(ctx, fromCallback = false) {
        try {
            const chats = await this.groupService.getJoinedChats(ctx);
            
            if (chats.channels.length === 0) {
                const message = "I haven't joined any channels yet.";
                
                if (fromCallback) {
                    return ctx.editMessageText(message, KeyboardUtils.getBackKeyboard());
                }
                return ctx.reply(message, KeyboardUtils.getBackKeyboard());
            }
            
            let message = "📡 *Channels I've joined:*\n\n";
            
            chats.channels.forEach((channel, index) => {
                message += `${index + 1}. *${channel.title}*\n`;
                if (channel.username) message += `   @${channel.username}\n`;
                message += `   ID: \`${channel.id}\`\n\n`;
            });
            
            const options = { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getBackKeyboard()
            };
            
            if (fromCallback) {
                return ctx.editMessageText(message, options);
            }
            return ctx.reply(message, options);
        } catch (error) {
            logger.error('Error listing channels:', error);
            const errorMessage = "Sorry, I encountered an error while listing the channels.";
            
            if (fromCallback) {
                return ctx.editMessageText(errorMessage, KeyboardUtils.getBackKeyboard());
            }
            return ctx.reply(errorMessage, KeyboardUtils.getBackKeyboard());
        }
    }
    
    async handleAllChatsCommand(ctx, fromCallback = false) {
        try {
            logger.info('Fetching chat data for all chats command');
            const chats = await this.groupService.getJoinedChats(ctx);
            const groups = [...chats.groups, ...chats.supergroups];
            
            logger.info(`Found ${groups.length} groups and ${chats.channels.length} channels`);
            
            if (groups.length === 0 && chats.channels.length === 0) {
                logger.info('No chats to display, sending empty response');
                const message = "I haven't joined any groups or channels yet.";
                
                if (fromCallback) {
                    return ctx.editMessageText(message, KeyboardUtils.getBackKeyboard());
                }
                return ctx.reply(message, KeyboardUtils.getBackKeyboard());
            }
            
            let message = "🔍 *All Chats I've Joined*\n\n";
            
            if (groups.length > 0) {
                message += "📋 *Groups:*\n\n";
                groups.forEach((group, index) => {
                    message += `${index + 1}. *${group.title}*\n`;
                    if (group.username) message += `   @${group.username}\n`;
                    message += `   Type: ${group.type}\n`;
                    message += `   ID: \`${group.id}\`\n\n`;
                });
            }
            
            if (chats.channels.length > 0) {
                message += "\n📡 *Channels:*\n\n";
                chats.channels.forEach((channel, index) => {
                    message += `${index + 1}. *${channel.title}*\n`;
                    if (channel.username) message += `   @${channel.username}\n`;
                    message += `   ID: \`${channel.id}\`\n\n`;
                });
            }
            
            const options = { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getBackKeyboard()
            };
            
            logger.info('Sending all chats response');
            if (fromCallback) {
                return ctx.editMessageText(message, options);
            }
            return ctx.reply(message, options);
            
        } catch (error) {
            logger.error('Error listing all chats:', error);
            const errorMessage = "Sorry, I encountered an error while listing the chats.";
            
            if (fromCallback) {
                return ctx.editMessageText(errorMessage, KeyboardUtils.getBackKeyboard());
            }
            return ctx.reply(errorMessage, KeyboardUtils.getBackKeyboard());
        }
    }
    
    async handleAddUserCommand(ctx) {
        try {
            // Only the bot owner (defined in .env) can add users
            const botOwner = process.env.BOT_OWNER ? Number(process.env.BOT_OWNER) : null;
            
            if (!botOwner || ctx.from.id !== botOwner) {
                return ctx.reply("This command is only available to the bot owner.", KeyboardUtils.getMainMenuKeyboard());
            }
            
            // Extract user ID from command (format: /adduser 123456789)
            const args = ctx.message.text.split(' ');
            if (args.length !== 2 || isNaN(Number(args[1]))) {
                return ctx.reply("Please use the format: /adduser [user_id]", KeyboardUtils.getMainMenuKeyboard());
            }
            
            const userId = Number(args[1]);
            
            // Get current authorized users
            const currentAuthorizedUsers = process.env.AUTHORIZED_USERS ? 
                process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
                [];
            
            // Add the new user if not already in the list
            if (currentAuthorizedUsers.includes(userId)) {
                return ctx.reply(`User ${userId} is already authorized.`, KeyboardUtils.getMainMenuKeyboard());
            }
            
            // Add user to env variable (Note: This doesn't persist across restarts)
            currentAuthorizedUsers.push(userId);
            process.env.AUTHORIZED_USERS = currentAuthorizedUsers.join(',');
            
            return ctx.reply(`User ${userId} has been authorized to use the bot.`, KeyboardUtils.getMainMenuKeyboard());
        } catch (error) {
            logger.error('Error adding authorized user:', error);
            return ctx.reply("Sorry, I encountered an error while adding the user.", KeyboardUtils.getMainMenuKeyboard());
        }
    }
    
    async handleWhoAmICommand(ctx, fromCallback = false) {
        // Show the user's ID and other details - useful for getting IDs for authorization
        try {
            const userId = ctx.from.id;
            const username = ctx.from.username || 'None';
            const firstName = ctx.from.first_name || '';
            const lastName = ctx.from.last_name || '';
            const chatId = ctx.chat.id;
            const chatType = ctx.chat.type;
            
            const message = `👤 *Your User Information:*\n
🆔 User ID: \`${userId}\`
👤 Username: @${username}
📝 Name: ${firstName} ${lastName}
💬 Current Chat ID: \`${chatId}\`
📂 Chat Type: ${chatType}`;
            
            const options = { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getBackKeyboard()
            };
            
            if (fromCallback) {
                return ctx.editMessageText(message, options);
            }
            return ctx.reply(message, options);
        } catch (error) {
            logger.error('Error in whoami command:', error);
            const errorMessage = "Sorry, I couldn't retrieve your user information.";
            
            if (fromCallback) {
                return ctx.editMessageText(errorMessage, KeyboardUtils.getBackKeyboard());
            }
            return ctx.reply(errorMessage, KeyboardUtils.getBackKeyboard());
        }
    }

    handleUnknownCommand(ctx) {
        const message = "Sorry, I didn't understand that command.";
        ctx.reply(message, KeyboardUtils.getMainMenuKeyboard());
    }
    
    // Forward media workflow - Step 1: Start the process and select source channel
    async handleForwardMediaStart(ctx) {
        try {
            // Check if the user has permissions
            const botOwner = process.env.BOT_OWNER ? Number(process.env.BOT_OWNER) : null;
            const authorizedUsers = process.env.AUTHORIZED_USERS ? 
                process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
                [];
            
            if (ctx.from && botOwner && ctx.from.id !== botOwner && !authorizedUsers.includes(ctx.from.id)) {
                return ctx.editMessageText("Only authorized users can forward media.", KeyboardUtils.getMainMenuKeyboard());
            }
            
            // Get list of channels
            const chats = await this.groupService.getJoinedChats(ctx);
            
            if (chats.channels.length === 0) {
                return ctx.editMessageText(
                    "I haven't joined any channels yet. Please add me to channels first.",
                    KeyboardUtils.getMainMenuKeyboard()
                );
            }
            
            // Display source channel selection
            return ctx.editMessageText(
                "📤 *Step 1:* Select the SOURCE channel (where to get media from):",
                { 
                    parse_mode: 'Markdown',
                    ...KeyboardUtils.getChannelSelectKeyboard(chats.channels, 'src_channel_')
                }
            );
        } catch (error) {
            logger.error('Error starting forward media process:', error);
            return ctx.editMessageText(
                "❌ An error occurred while starting the media forwarding process.",
                KeyboardUtils.getMainMenuKeyboard()
            );
        }
    }
    
    // Forward media workflow - Step 2: Source channel selected, now select target channel
    async handleSourceChannelSelected(ctx, sourceChannelId) {
        try {
            const userId = ctx.from.id;
            
            // Store the source channel ID in the session
            sessionManager.updateSession(userId, { sourceChannelId });
            
            logger.info(`User ${userId} selected source channel: ${sourceChannelId}`);
            
            // Get list of channels
            const chats = await this.groupService.getJoinedChats(ctx);
            
            // Remove the source channel from the list
            const targetChannels = chats.channels.filter(channel => channel.id !== sourceChannelId);
            
            if (targetChannels.length === 0) {
                return ctx.editMessageText(
                    "You need at least two channels to forward media. Please add me to another channel.",
                    KeyboardUtils.getBackKeyboard('cmd_forward_media')
                );
            }
            
            // Display target channel selection
            return ctx.editMessageText(
                `📥 *Step 2:* Select the TARGET channel (where to send media to):\n\n*Source:* ${sourceChannelId}`,
                { 
                    parse_mode: 'Markdown',
                    ...KeyboardUtils.getChannelSelectKeyboard(targetChannels, 'tgt_channel_')
                }
            );
        } catch (error) {
            logger.error('Error handling source channel selection:', error);
            return ctx.editMessageText(
                "❌ An error occurred while selecting the source channel.",
                KeyboardUtils.getMainMenuKeyboard()
            );
        }
    }
    
    // Forward media workflow - Step 3: Target channel selected, now select limit
    async handleTargetChannelSelected(ctx, sourceChannelId, targetChannelId) {
        try {
            const userId = ctx.from.id;
            
            // Store the target channel ID in the session
            sessionManager.updateSession(userId, { targetChannelId });
            
            logger.info(`User ${userId} selected target channel: ${targetChannelId}`);
            
            // Display message count selection
            return ctx.editMessageText(
                `🔢 *Step 3:* Select how many media items to forward:\n\n*From:* ${sourceChannelId}\n*To:* ${targetChannelId}`,
                { 
                    parse_mode: 'Markdown',
                    ...KeyboardUtils.getLimitSelectionKeyboard(sourceChannelId, targetChannelId)
                }
            );
        } catch (error) {
            logger.error('Error handling target channel selection:', error);
            return ctx.editMessageText(
                "❌ An error occurred while selecting the target channel.",
                KeyboardUtils.getBackKeyboard('cmd_forward_media')
            );
        }
    }
    
    // Forward media workflow - Step 4: Execute the forwarding operation
    async executeForwardMedia(ctx, sourceChannelId, targetChannelId, limit) {
        try {
            logger.info(`Executing media forward: ${sourceChannelId} -> ${targetChannelId}, limit: ${limit}`);
            
            // Update the message to show progress
            await ctx.editMessageText(
                `🔄 *Forwarding in progress*\n\n` +
                `From: \`${sourceChannelId}\`\n` +
                `To: \`${targetChannelId}\`\n` +
                `Limit: ${limit} media items\n\n` +
                `Please wait, this may take a moment...`,
                { parse_mode: 'Markdown' }
            );
            
            // Execute the forwarding
            const result = await this.groupService.forwardMediaBetweenChannels(
                sourceChannelId,
                targetChannelId,
                limit
            );
            
            // Show the result
            if (result.success) {
                await ctx.editMessageText(
                    `✅ *Forwarding complete!*\n\n` +
                    `Successfully forwarded ${result.count} media items.\n\n` +
                    `From: \`${sourceChannelId}\`\n` +
                    `To: \`${targetChannelId}\``,
                    { 
                        parse_mode: 'Markdown',
                        ...KeyboardUtils.getMainMenuKeyboard()
                    }
                );
            } else {
                await ctx.editMessageText(
                    `⚠️ *Forwarding completed with issues*\n\n` +
                    `Forwarded: ${result.count} media items\n` +
                    `Failed: ${result.errors} items\n\n` +
                    `From: \`${sourceChannelId}\`\n` +
                    `To: \`${targetChannelId}\``,
                    { 
                        parse_mode: 'Markdown',
                        ...KeyboardUtils.getMainMenuKeyboard()
                    }
                );
            }
            
            // Clear the session
            sessionManager.clearSession(ctx.from.id);
            
        } catch (error) {
            logger.error('Error executing forward media operation:', error);
            await ctx.editMessageText(
                "❌ An error occurred while forwarding media. Please check the logs for details.",
                KeyboardUtils.getMainMenuKeyboard()
            );
        }
    }

    // Legacy handleForwardMediaCommand for backward compatibility with text commands
    async handleForwardMediaCommand(ctx) {
        try {
            // Check if the user has permissions
            const botOwner = process.env.BOT_OWNER ? Number(process.env.BOT_OWNER) : null;
            const authorizedUsers = process.env.AUTHORIZED_USERS ? 
                process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
                [];
            
            if (ctx.from && botOwner && ctx.from.id !== botOwner && !authorizedUsers.includes(ctx.from.id)) {
                return ctx.reply("Only authorized users can use this command. Please use the buttons instead.", 
                    KeyboardUtils.getMainMenuKeyboard());
            }
            
            // Get list of channels
            const chats = await this.groupService.getJoinedChats(ctx);
            
            if (chats.channels.length === 0) {
                return ctx.reply(
                    "I haven't joined any channels yet. Please add me to channels first.",
                    KeyboardUtils.getMainMenuKeyboard()
                );
            }
            
            // Start the interactive workflow instead of command parameters
            return ctx.reply(
                "📤 *Media Forwarding*\n\nPlease use the buttons below to select source and target channels:",
                { 
                    parse_mode: 'Markdown',
                    ...KeyboardUtils.getChannelSelectKeyboard(chats.channels, 'src_channel_')
                }
            );
        } catch (error) {
            logger.error('Error handling forward media command:', error);
            await ctx.reply("❌ An error occurred while starting media forwarding.", KeyboardUtils.getMainMenuKeyboard());
        }
    }
}

module.exports = CommandHandler;