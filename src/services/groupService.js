const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

class GroupService {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Join a Telegram group using an invite link
   * @param {string} inviteLink - The Telegram invitation link
   * @returns {Promise<boolean>} - Success or failure
   */
  async joinGroup(inviteLink) {
    try {
      if (!helpers.isTelegramInviteLink(inviteLink)) {
        logger.error('Invalid Telegram invite link format');
        return false;
      }

      const inviteCode = helpers.extractInviteCode(inviteLink);
      if (!inviteCode) {
        logger.error('Could not extract invite code from link');
        return false;
      }

      // Using Telegraf's telegram instance to access Telegram Bot API directly
      // Note: This requires the bot to have the correct permissions
      await this.bot.telegram.joinChat(inviteCode);
      logger.info(`Successfully joined group via invite: ${inviteLink}`);
      return true;
    } catch (error) {
      logger.error('Failed to join group:', error.message);
      return false;
    }
  }

  /**
   * Leave a Telegram group
   * @param {number} chatId - The ID of the group to leave
   * @returns {Promise<boolean>} - Success or failure
   */
  async leaveGroup(chatId) {
    try {
      await this.bot.telegram.leaveChat(chatId);
      logger.info(`Successfully left group: ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to leave group ${chatId}:`, error.message);
      return false;
    }
  }
}

module.exports = GroupService;
