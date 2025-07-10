class CommandHandler {
    constructor(groupService) {
        this.groupService = groupService;
    }

    handleStartCommand(ctx) {
        const message = "Welcome to the Telegram Bot! Use /help to see available commands.";
        ctx.reply(message);
    }

    handleHelpCommand(ctx) {
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
        ctx.reply(message, { parse_mode: 'Markdown' });
    }
    
    async handleGroupsCommand(ctx) {
        try {
            const chats = await this.groupService.getJoinedChats();
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
            const chats = await this.groupService.getJoinedChats();
            
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
            const chats = await this.groupService.getJoinedChats();
            const groups = [...chats.groups, ...chats.supergroups];
            
            if (groups.length === 0 && chats.channels.length === 0) {
                return ctx.reply("I haven't joined any groups or channels yet.");
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
            
            return ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error listing all chats:', error);
            return ctx.reply("Sorry, I encountered an error while listing the chats.");
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