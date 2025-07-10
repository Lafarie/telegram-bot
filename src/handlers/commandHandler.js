const logger = require('../utils/logger');

class CommandHandler {
    constructor(groupService) {
        this.groupService = groupService;
    }

    async handleStartCommand(ctx) {
        try {
            const message = "Welcome to the Telegram Bot! Use /help to see available commands.";
            logger.info('Sending start command response');
            await ctx.reply(message);
            logger.info('Start command response sent successfully');
        } catch (error) {
            logger.error('Error sending start command response:', error);
        }
    }

    async handleHelpCommand(ctx) {
        try {
            const message = `📋 *Available commands:*

*Basic Commands:*
/start - Welcome message
/help - List of commands
/whoami - Show your user ID and information

*Group & Channel Management:*
/groups - List all groups I've joined
/channels - List all channels I've joined
/allchats - List all groups and channels I've joined

*Admin Commands:*
/adduser [user_id] - Add a user to authorized users (bot owner only)

You can also send me a Telegram group invitation link, and I'll automatically join that group!`;
            
            logger.info('Sending help command response');
            await ctx.reply(message, { parse_mode: 'Markdown' });
            logger.info('Help command response sent successfully');
        } catch (error) {
            logger.error('Error sending help command response:', error);
            // Try without markdown
            try {
                const plainMessage = message.replace(/\*/g, '');
                await ctx.reply(plainMessage);
            } catch (secondError) {
                logger.error('Error sending plain help message:', secondError);
            }
        }
    }
    
    async handleGroupsCommand(ctx) {
        try {
            const chats = await this.groupService.getJoinedChats(ctx);
            const groups = [...chats.groups, ...chats.supergroups];
            
            if (groups.length === 0) {
                return ctx.reply("I haven't joined any groups yet.");
            }
            
            let message = "📋 *Groups I've joined:*\n\n";
            
            groups.forEach((group, index) => {
                message += `${index + 1}. *${group.title}*\n`;
                if (group.username) message += `   @${group.username}\n`;
                message += `   Type: ${group.type}\n`;
                message += `   Joined: ${new Date(group.joinedAt).toLocaleString()}\n\n`;
            });
            
            return ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error listing groups:', error);
            return ctx.reply("Sorry, I encountered an error while listing the groups.");
        }
    }
    
    async handleChannelsCommand(ctx) {
        try {
            const chats = await this.groupService.getJoinedChats(ctx);
            
            if (chats.channels.length === 0) {
                return ctx.reply("I haven't joined any channels yet.");
            }
            
            let message = "📡 *Channels I've joined:*\n\n";
            
            chats.channels.forEach((channel, index) => {
                message += `${index + 1}. *${channel.title}*\n`;
                if (channel.username) message += `   @${channel.username}\n`;
                message += `   Joined: ${new Date(channel.joinedAt).toLocaleString()}\n\n`;
            });
            
            return ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error listing channels:', error);
            return ctx.reply("Sorry, I encountered an error while listing the channels.");
        }
    }
    
    async handleAllChatsCommand(ctx) {
        try {
            logger.info('Fetching chat data for /allchats command');
            // Pass the current context to getJoinedChats to track the current chat
            const chats = await this.groupService.getJoinedChats(ctx);
            const groups = [...chats.groups, ...chats.supergroups];
            
            logger.info(`Found ${groups.length} groups and ${chats.channels.length} channels`);
            
            if (groups.length === 0 && chats.channels.length === 0) {
                logger.info('No chats to display, sending empty response');
                return await ctx.reply("I haven't joined any groups or channels yet.");
            }
            
            let message = "🔍 *All Chats I've Joined*\n\n";
            
            if (groups.length > 0) {
                message += "📋 *Groups:*\n\n";
                groups.forEach((group, index) => {
                    message += `${index + 1}. *${group.title}*\n`;
                    if (group.username) message += `   @${group.username}\n`;
                    message += `   Type: ${group.type}\n\n`;
                });
            }
            
            if (chats.channels.length > 0) {
                message += "\n📡 *Channels:*\n\n";
                chats.channels.forEach((channel, index) => {
                    message += `${index + 1}. *${channel.title}*\n`;
                    if (channel.username) message += `   @${channel.username}\n\n`;
                });
            }
            
            logger.info('Sending allchats command response');
            const response = await ctx.reply(message, { parse_mode: 'Markdown' });
            logger.info('Allchats command response sent successfully');
            return response;
        } catch (error) {
            logger.error('Error listing all chats:', error);
            
            // Try to send a simpler message without markdown
            try {
                logger.info('Attempting to send plain text response');
                const plainMessage = "There was an error formatting the chat list. Here's what I could retrieve:\n\n";
                
                const chats = await this.groupService.getJoinedChats();
                let chatInfo = '';
                
                if (chats.groups.length > 0 || chats.supergroups.length > 0) {
                    chatInfo += "Groups: " + [...chats.groups, ...chats.supergroups].map(g => g.title).join(', ') + "\n\n";
                }
                
                if (chats.channels.length > 0) {
                    chatInfo += "Channels: " + chats.channels.map(c => c.title).join(', ');
                }
                
                return await ctx.reply(plainMessage + chatInfo);
            } catch (secondError) {
                logger.error('Second error when sending simplified chat list:', secondError);
                return await ctx.reply("Sorry, I encountered an error while listing the chats.");
            }
        }
    }
    
    async handleAddUserCommand(ctx) {
        try {
            // Only the bot owner (defined in .env) can add users
            const botOwner = process.env.BOT_OWNER ? Number(process.env.BOT_OWNER) : null;
            
            if (!botOwner || ctx.from.id !== botOwner) {
                return ctx.reply("This command is only available to the bot owner.");
            }
            
            // Extract user ID from command (format: /adduser 123456789)
            const args = ctx.message.text.split(' ');
            if (args.length !== 2 || isNaN(Number(args[1]))) {
                return ctx.reply("Please use the format: /adduser [user_id]");
            }
            
            const userId = Number(args[1]);
            
            // Get current authorized users
            const currentAuthorizedUsers = process.env.AUTHORIZED_USERS ? 
                process.env.AUTHORIZED_USERS.split(',').map(id => Number(id)) : 
                [];
            
            // Add the new user if not already in the list
            if (currentAuthorizedUsers.includes(userId)) {
                return ctx.reply(`User ${userId} is already authorized.`);
            }
            
            // Add user to env variable (Note: This doesn't persist across restarts)
            currentAuthorizedUsers.push(userId);
            process.env.AUTHORIZED_USERS = currentAuthorizedUsers.join(',');
            
            return ctx.reply(`User ${userId} has been authorized to use the bot.`);
        } catch (error) {
            console.error('Error adding authorized user:', error);
            return ctx.reply("Sorry, I encountered an error while adding the user.");
        }
    }
    
    async handleWhoAmICommand(ctx) {
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
            
            return ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error in whoami command:', error);
            return ctx.reply("Sorry, I couldn't retrieve your user information.");
        }
    }

    handleUnknownCommand(ctx) {
        const message = "Sorry, I didn't understand that command. Use /help to see available commands.";
        ctx.reply(message);
    }
}

module.exports = CommandHandler;