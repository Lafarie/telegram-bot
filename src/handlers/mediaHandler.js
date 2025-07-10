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
    // Handle both regular messages and channel posts
    const message = ctx.message || ctx.channelPost;
    
    if (!message) {
      return ctx.reply('Unable to process this media.');
    }
    
    const mediaFile = message.document || (message.photo && message.photo[0]);

    if (mediaFile) {
      const fileId = mediaFile.file_id;
      
      // For channel posts, we may need special handling
      if (ctx.channelPost) {
        if (ctx.channelPost.photo) {
          await ctx.replyWithPhoto(fileId);
        } else if (ctx.channelPost.document) {
          await ctx.replyWithDocument(fileId);
        }
        return; // In channels, don't send confirmation message
      } else {
        // Regular message flow
        await this.forwardMedia(ctx, fileId);
        await ctx.reply('Media has been forwarded successfully!');
      }
    } else {
      await ctx.reply('Please upload a valid media file.');
    }
  }
}

module.exports = MediaHandler;