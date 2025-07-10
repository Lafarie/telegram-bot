const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

class GroupService {
  constructor(bot) {
    this.bot = bot;
    // Store joined groups and channels in memory
    this.joinedGroups = new Map();
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
      const chatResponse = await this.bot.telegram.joinChat(inviteCode);
      
      // Store information about the joined group/channel
      if (chatResponse) {
        this.addJoinedChat(chatResponse);
        logger.info(`Successfully joined chat via invite: ${inviteLink}`);
      }
      
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
      
      // Remove from our stored list
      this.joinedGroups.delete(chatId);
      
      logger.info(`Successfully left group: ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to leave group ${chatId}:`, error.message);
      return false;
    }
  }
  
  /**
   * Add a joined chat to our internal map
   * @param {Object} chat - The chat object from Telegram
   */
  addJoinedChat(chat) {
    if (!chat || !chat.id) return;
    
    this.joinedGroups.set(chat.id, {
      id: chat.id,
      title: chat.title || 'Unnamed',
      type: chat.type || 'unknown',
      username: chat.username || null,
      joinedAt: new Date(),
      memberCount: chat.member_count || 0
    });
  }
  
  /**
   * Get all groups and channels the bot has joined
   * @returns {Object} Object with separate arrays for groups and channels
   */
  async getJoinedChats() {
    try {
      // If the stored list is empty, try to refresh from Telegram
      // Note: Telegram doesn't provide a direct API to get all joined chats,
      // so this only works for chats we've joined during this bot session
      
      const result = {
        groups: [],
        channels: [],
        supergroups: []
      };
      
      // Convert Map to arrays separated by chat type
      for (const chat of this.joinedGroups.values()) {
        if (chat.type === 'group') {
          result.groups.push(chat);
        } else if (chat.type === 'channel') {
          result.channels.push(chat);
        } else if (chat.type === 'supergroup') {
          result.supergroups.push(chat);
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Error getting joined chats:', error);
      return { groups: [], channels: [], supergroups: [] };
    }
  }
  
  /**
   * Update the list of joined chats
   * This method attempts to get information about all chats the bot is in
   * @param {Array} updates - Array of updates from Telegram that might contain chat info
   */
  updateJoinedChatsFromUpdates(updates) {
    if (!Array.isArray(updates)) return;
    
    for (const update of updates) {
      // Extract chat info from various update types
      const chat = update.message?.chat || 
                   update.channel_post?.chat || 
                   update.edited_message?.chat ||
                   update.callback_query?.message?.chat;
      
      if (chat && (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel')) {
        this.addJoinedChat(chat);
      }
    }
  }
}

module.exports = GroupService;
