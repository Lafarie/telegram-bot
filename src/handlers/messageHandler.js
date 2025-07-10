class MessageHandler {
  constructor() {
    // Constructor no longer needs to store bot instance
  }

  handleTextMessage(ctx) {
    const text = ctx.message.text;

    // Basic command handling
    if (text.startsWith('/start')) {
      this.sendWelcomeMessage(ctx);
    } else if (text.startsWith('/help')) {
      this.sendHelpMessage(ctx);
    } else {
      this.handleUnknownMessage(ctx);
    }
  }

  sendWelcomeMessage(ctx) {
    const welcomeText = "Welcome to the bot! Use /help to see available commands.";
    ctx.reply(welcomeText);
  }

  sendHelpMessage(ctx) {
    const helpText = "Available commands:\n/start - Start the bot\n/help - Show this help message";
    ctx.reply(helpText);
  }

  handleUnknownMessage(ctx) {
    const unknownText = "Sorry, I didn't understand that. Type /help for assistance.";
    ctx.reply(unknownText);
  }
}

module.exports = MessageHandler;