class MediaHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async forwardMedia(chatId, mediaFile) {
    try {
      await this.bot.sendDocument(chatId, mediaFile);
    } catch (error) {
      console.error('Error forwarding media:', error);
    }
  }

  async handleMediaUpload(ctx) {
    const { chat, message_id } = ctx.message;
    const mediaFile = ctx.message.document || ctx.message.photo;

    if (mediaFile) {
      await this.forwardMedia(chat.id, mediaFile.file_id);
      await ctx.reply('Media has been forwarded successfully!');
    } else {
      await ctx.reply('Please upload a valid media file.');
    }
  }
}

module.exports = MediaHandler;