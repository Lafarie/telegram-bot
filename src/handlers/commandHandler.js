class CommandHandler {
    constructor() {
        // Constructor no longer needs to store bot instance
    }

    handleStartCommand(ctx) {
        const message = "Welcome to the Telegram Bot! Use /help to see available commands.";
        ctx.reply(message);
    }

    handleHelpCommand(ctx) {
        const message = `
Available commands:
/start - Welcome message
/help - List of commands
        `;
        ctx.reply(message);
    }

    handleUnknownCommand(ctx) {
        const message = "Sorry, I didn't understand that command. Use /help to see available commands.";
        ctx.reply(message);
    }
}

module.exports = CommandHandler;