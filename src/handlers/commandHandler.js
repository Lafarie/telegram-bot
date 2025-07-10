class CommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    handleStartCommand(chatId) {
        const message = "Welcome to the Telegram Bot! Use /help to see available commands.";
        this.bot.sendMessage(chatId, message);
    }

    handleHelpCommand(chatId) {
        const message = `
Available commands:
/start - Welcome message
/help - List of commands
        `;
        this.bot.sendMessage(chatId, message);
    }

    handleUnknownCommand(chatId) {
        const message = "Sorry, I didn't understand that command. Use /help to see available commands.";
        this.bot.sendMessage(chatId, message);
    }
}

module.exports = CommandHandler;