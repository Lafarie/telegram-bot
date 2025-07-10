class MediaHandler {
  constructor() {
    // Constructor no longer needs to store bot instance
  }

  async forwardMedia(ctx, fileId) {
    try {
      if (ctx.message.document) {
        await ctx.replyWithDocument(fileId);
      } else if (ctx.message.photo) {
        await ctx.replyWithPhoto(fileId);
      }
    } catch (error) {
      console.error('Error forwarding media:', error);
    }
  }

  async handleMediaUpload(ctx) {
    const mediaFile = ctx.message.document || (ctx.message.photo && ctx.message.photo[0]);

    if (mediaFile) {
      const fileId = mediaFile.file_id;
      await this.forwardMedia(ctx, fileId);
      await ctx.reply('Media has been forwarded successfully!');
    } else {
      await ctx.reply('Please upload a valid media file.');
    }
  }
}

module.exports = MediaHandler;