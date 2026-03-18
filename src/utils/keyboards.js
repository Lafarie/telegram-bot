const { Markup } = require('telegraf');

/**
 * Keyboard utilities for interactive bot commands
 */
class KeyboardUtils {
  static getPrimaryAiKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📋 Help & Options', 'cmd_help')],
      [Markup.button.callback('📊 AI Actions', 'cmd_ai_actions')]
    ]);
  }

  static getAiActionsKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📈 Get All Analytics', 'ai_analytics_all')],
      [
        Markup.button.callback('💰 Sales Revenue 24h', 'ai_revenue_24h'),
        Markup.button.callback('💰 Sales Revenue 48h', 'ai_revenue_48h')
      ],
      [
        Markup.button.callback('📅 Sales Revenue 7d', 'ai_revenue_7d'),
        Markup.button.callback('🔥 Top Products', 'ai_top_products')
      ],
      [
        Markup.button.callback('🧾 Orders Summary', 'ai_orders_summary'),
        Markup.button.callback('📉 Conversion Report', 'ai_conversion')
      ],
      [Markup.button.callback('🔄 Refresh KPI Snapshot', 'ai_kpi_refresh')],
      [Markup.button.callback('◀️ Back', 'cmd_help')]
    ]);
  }

  static getHelpOptionsKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📊 AI Actions', 'cmd_ai_actions')],
      [Markup.button.callback('🏠 AI Home', 'cmd_ai_home')]
    ]);
  }

  /**
   * Create a main menu keyboard with all primary commands
   * @returns {Object} Markup keyboard
   */
  static getMainMenuKeyboard() {
    return this.getPrimaryAiKeyboard();
  }

  /**
   * Create a keyboard with back button
   * @param {String} backCommand - The callback data for back button
   * @returns {Object} Markup keyboard with back button
   */
  static getBackKeyboard(backCommand = 'cmd_main_menu') {
    return Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Back', backCommand)]
    ]);
  }

  /**
   * Create a keyboard for channel selection
   * @param {Array} channels - List of channels
   * @param {String} prefix - Prefix for callback data
   * @returns {Object} Markup keyboard with channel buttons
   */
  static getChannelSelectKeyboard(channels, prefix = 'src_channel_') {
    // Split channels into rows of 2 buttons each
    const buttons = [];
    const maxButtons = 8; // Telegram allows max 8 buttons in inline keyboard
    
    // Limit to first 8 channels
    const limitedChannels = channels.slice(0, maxButtons);
    
    // Create buttons in rows of 2
    for (let i = 0; i < limitedChannels.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(
        limitedChannels[i].title.substring(0, 20), // Limit title length
        `${prefix}${limitedChannels[i].id}`
      ));
      
      if (i + 1 < limitedChannels.length) {
        row.push(Markup.button.callback(
          limitedChannels[i + 1].title.substring(0, 20), // Limit title length
          `${prefix}${limitedChannels[i + 1].id}`
        ));
      }
      
      buttons.push(row);
    }
    
    // Add back button at the bottom
    buttons.push([Markup.button.callback('◀️ Back', 'cmd_main_menu')]);
    
    return Markup.inlineKeyboard(buttons);
  }

  /**
   * Create a keyboard for selecting number of messages to forward
   * @param {Number} sourceChannelId - ID of source channel
   * @param {Number} targetChannelId - ID of target channel
   * @returns {Object} Markup keyboard
   */
  static getLimitSelectionKeyboard(sourceChannelId, targetChannelId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('5 items', `fwd_${sourceChannelId}_${targetChannelId}_5`),
        Markup.button.callback('10 items', `fwd_${sourceChannelId}_${targetChannelId}_10`),
        Markup.button.callback('20 items', `fwd_${sourceChannelId}_${targetChannelId}_20`)
      ],
      [
        Markup.button.callback('30 items', `fwd_${sourceChannelId}_${targetChannelId}_30`),
        Markup.button.callback('50 items', `fwd_${sourceChannelId}_${targetChannelId}_50`)
      ],
      [Markup.button.callback('◀️ Back to channel selection', 'cmd_forward_media')]
    ]);
  }
}

module.exports = KeyboardUtils;
