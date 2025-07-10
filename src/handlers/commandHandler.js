class CommandHandler {
    constructor(groupService) {
        this.groupService = groupService;
    }

    handleStartCommand(ctx) {
        const message = "Welcome to the Telegram Bot! Use /help to see available commands.";
        ctx.reply(message);
    }

    handleHelpCommand(ctx) {
        const message = `Available commands:
/start - Welcome message
/help - List of commands
/groups - List all groups I've joined
/channels - List all channels I've joined
/allchats - List all groups and channels I've joined

You can also send me a Telegram group invitation link, and I'll automatically join that group!`;
        ctx.reply(message);
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

    handleUnknownCommand(ctx) {
        const message = "Sorry, I didn't understand that command. Use /help to see available commands.";
        ctx.reply(message);
    }
}

module.exports = CommandHandler;