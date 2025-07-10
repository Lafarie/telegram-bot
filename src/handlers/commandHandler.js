const logger = require('../utils/logger');
const KeyboardUtils = require('../utils/keyboards');
const sessionManager = require('../utils/sessionManager');

class CommandHandler {
    constructor(groupService, forwardingService) {
        this.groupService = groupService;
        this.forwardingService = forwardingService;
    }

    async handleStartCommand(ctx) {
        try {
            const message = "Welcome to the Media Forwarding Bot! Use the buttons below to navigate:";
            logger.info('Sending start command with main menu');
            
            // Show main menu with inline keyboard
            await ctx.reply(message, KeyboardUtils.getMainMenuKeyboard());
            logger.info('Start command response sent successfully');
        } catch (error) {
            logger.error('Error sending start command response:', error);
        }
    }

    async handleHelpCommand(ctx) {
        try {
            const message = `📋 *Bot Help & Information*

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
            
            logger.info('Sending help command response');
            await ctx.reply(message, { 
                parse_mode: 'Markdown',
                ...KeyboardUtils.getBackKeyboard()
            });
            logger.info('Help command response sent successfully');
        } catch (error) {
            logger.error('Error sending help command response:', error);
            // Try without markdown
            try {
                const plainMessage = message.replace(/\*/g, '');
                await ctx.reply(plainMessage, KeyboardUtils.getBackKeyboard());
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
            } else if (callbackData === 'cmd_help') {
                return this.handleHelpCommand(ctx);
            } else if (callbackData === 'cmd_groups') {
                return this.handleGroupsCommand(ctx, true);
            } else if (callbackData === 'cmd_channels') {
                return this.handleChannelsCommand(ctx, true);
            } else if (callbackData === 'cmd_all_chats') {
                return this.handleAllChatsCommand(ctx, true);
            } else if (callbackData === 'cmd_whoami') {
                return this.handleWhoAmICommand(ctx, true);
            } else if (callbackData === 'cmd_forward_media') {
                return this.handleForwardMediaStart(ctx);
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
            const message = "Main Menu - Please select an option:";
            await ctx.editMessageText(message, KeyboardUtils.getMainMenuKeyboard());
        } catch (error) {
            logger.error('Error sending main menu:', error);
            // If we can't edit, send a new message
            try {
                await ctx.reply("Main Menu - Please select an option:", KeyboardUtils.getMainMenuKeyboard());
            } catch (replyError) {
                logger.error('Error sending main menu as new message:', replyError);
            }
        }
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