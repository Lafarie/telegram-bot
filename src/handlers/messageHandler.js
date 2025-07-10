class MessageHandler {
  constructor(bot) {
    this.bot = bot;
  }

  handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Basic command handling
    if (text.startsWith('/start')) {
      this.sendWelcomeMessage(chatId);
    } else if (text.startsWith('/help')) {
      this.sendHelpMessage(chatId);
    } else {
      this.handleUnknownMessage(chatId);
    }
  }

  sendWelcomeMessage(chatId) {
    const welcomeText = "Welcome to the bot! Use /help to see available commands.";
    this.bot.sendMessage(chatId, welcomeText);
  }

  sendHelpMessage(chatId) {
    const helpText = "Available commands:\n/start - Start the bot\n/help - Show this help message";
    this.bot.sendMessage(chatId, helpText);
  }

  handleUnknownMessage(chatId) {
    const unknownText = "Sorry, I didn't understand that. Type /help for assistance.";
    this.bot.sendMessage(chatId, unknownText);
  }
}

module.exports = MessageHandler;