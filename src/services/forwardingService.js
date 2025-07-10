const logger = require('../utils/logger');

class ForwardingService {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Forward a message directly using Telegram's forwardMessage method
   * @param {number} toChatId - Target chat ID
   * @param {number} fromChatId - Source chat ID
   * @param {number} messageId - Message ID to forward
   * @returns {Promise<Object>} - Forwarded message
   */
  async forwardMessage(toChatId, fromChatId, messageId) {
    try {
      logger.info(`Forwarding message ${messageId} from ${fromChatId} to ${toChatId}`);
      const result = await this.bot.telegram.forwardMessage(
        toChatId,
        fromChatId,
        messageId,
        { disable_notification: true }
      );
      logger.info(`Message forwarded successfully: ${messageId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Copy a message with its content using Telegram's copyMessage method
   * @param {number} toChatId - Target chat ID
   * @param {number} fromChatId - Source chat ID
   * @param {number} messageId - Message ID to copy
   * @returns {Promise<Object>} - Copied message
   */
  async copyMessage(toChatId, fromChatId, messageId) {
    try {
      logger.info(`Copying message ${messageId} from ${fromChatId} to ${toChatId}`);
      const result = await this.bot.telegram.copyMessage(
        toChatId,
        fromChatId,
        messageId,
        { disable_notification: true }
      );
      logger.info(`Message copied successfully: ${messageId}`);
      return result;
    } catch (error) {
      logger.error(`Error copying message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Forward photo using the photo's file_id
   * @param {number} chatId - Target chat ID
   * @param {Object} photo - Photo object from Telegram
   * @param {string} caption - Optional caption for the photo
   * @returns {Promise<Object>} - Sent message
   */
  async forwardPhoto(chatId, photo, caption = '') {
    try {
      // Get the largest photo from the array (Telegram provides multiple sizes)
      const photoFile = Array.isArray(photo) ? photo[photo.length - 1] : photo;
      const fileId = photoFile.file_id;
      
      logger.info(`Forwarding photo ${fileId} to ${chatId}`);
      const result = await this.bot.telegram.sendPhoto(chatId, fileId, {
        caption: caption,
        disable_notification: true
      });
      logger.info(`Photo forwarded successfully: ${fileId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding photo:`, error);
      throw error;
    }
  }

  /**
   * Forward video using the video's file_id
   * @param {number} chatId - Target chat ID
   * @param {Object} video - Video object from Telegram
   * @param {string} caption - Optional caption for the video
   * @returns {Promise<Object>} - Sent message
   */
  async forwardVideo(chatId, video, caption = '') {
    try {
      const fileId = video.file_id;
      
      logger.info(`Forwarding video ${fileId} to ${chatId}`);
      const result = await this.bot.telegram.sendVideo(chatId, fileId, {
        caption: caption,
        disable_notification: true
      });
      logger.info(`Video forwarded successfully: ${fileId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding video:`, error);
      throw error;
    }
  }

  /**
   * Forward document using the document's file_id
   * @param {number} chatId - Target chat ID
   * @param {Object} document - Document object from Telegram
   * @param {string} caption - Optional caption for the document
   * @returns {Promise<Object>} - Sent message
   */
  async forwardDocument(chatId, document, caption = '') {
    try {
      const fileId = document.file_id;
      
      logger.info(`Forwarding document ${fileId} to ${chatId}`);
      const result = await this.bot.telegram.sendDocument(chatId, fileId, {
        caption: caption,
        disable_notification: true
      });
      logger.info(`Document forwarded successfully: ${fileId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding document:`, error);
      throw error;
    }
  }

  /**
   * Forward animation (GIF) using the animation's file_id
   * @param {number} chatId - Target chat ID
   * @param {Object} animation - Animation object from Telegram
   * @param {string} caption - Optional caption for the animation
   * @returns {Promise<Object>} - Sent message
   */
  async forwardAnimation(chatId, animation, caption = '') {
    try {
      const fileId = animation.file_id;
      
      logger.info(`Forwarding animation ${fileId} to ${chatId}`);
      const result = await this.bot.telegram.sendAnimation(chatId, fileId, {
        caption: caption,
        disable_notification: true
      });
      logger.info(`Animation forwarded successfully: ${fileId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding animation:`, error);
      throw error;
    }
  }

  /**
   * Forward audio using the audio's file_id
   * @param {number} chatId - Target chat ID
   * @param {Object} audio - Audio object from Telegram
   * @param {string} caption - Optional caption for the audio
   * @returns {Promise<Object>} - Sent message
   */
  async forwardAudio(chatId, audio, caption = '') {
    try {
      const fileId = audio.file_id;
      
      logger.info(`Forwarding audio ${fileId} to ${chatId}`);
      const result = await this.bot.telegram.sendAudio(chatId, fileId, {
        caption: caption,
        disable_notification: true
      });
      logger.info(`Audio forwarded successfully: ${fileId}`);
      return result;
    } catch (error) {
      logger.error(`Error forwarding audio:`, error);
      throw error;
    }
  }
}

module.exports = ForwardingService;