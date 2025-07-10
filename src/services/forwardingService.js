class ForwardingService {
  constructor(bot) {
    this.bot = bot;
  }

  async forwardMessage(chatId, messageId) {
    try {
      await this.bot.forwardMessage(chatId, messageId);
    } catch (error) {
      console.error('Error forwarding message:', error);
    }
  }

  async forwardMedia(chatId, media) {
    try {
      await this.bot.sendPhoto(chatId, media); // Example for photo, can be extended for other media types
    } catch (error) {
      console.error('Error forwarding media:', error);
    }
  }

  async forwardDocument(chatId, document) {
    try {
      await this.bot.sendDocument(chatId, document);
    } catch (error) {
      console.error('Error forwarding document:', error);
    }
  }

  async forwardVideo(chatId, video) {
    try {
      await this.bot.sendVideo(chatId, video);
    } catch (error) {
      console.error('Error forwarding video:', error);
    }
  }
}

module.exports = ForwardingService;