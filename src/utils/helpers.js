module.exports = {
  formatDate: (date) => {
    return date.toISOString().split('T')[0];
  },

  generateRandomString: (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  },

  isValidUrl: (string) => {
    const urlPattern = new RegExp('^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])?)\\.)+[a-z]{2,}|' + // domain name
      'localhost|' + // localhost
      '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|' + // IP address
      '\\[?[a-fA-F0-9]*:[a-fA-F0-9:]+\\])' + // IPv6
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!urlPattern.test(string);
  },

  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  isTelegramInviteLink: (url) => {
    // Check if the URL is a valid Telegram invite link
    // Formats: https://t.me/joinchat/XXXX or https://telegram.me/joinchat/XXXX or t.me/+XXXX
    const telegramInvitePattern = /^(https?:\/\/)?(t(elegram)?\.me)\/(\+|joinchat\/)[a-zA-Z0-9_-]+$/i;
    return telegramInvitePattern.test(url);
  },
  
  extractInviteCode: (url) => {
    // Extract the invite code from various Telegram invite link formats
    if (!url) return null;
    
    // Handle t.me/+CODE format
    if (url.includes('t.me/+') || url.includes('telegram.me/+')) {
      return url.split('/+')[1];
    }
    
    // Handle t.me/joinchat/CODE format
    if (url.includes('/joinchat/')) {
      return url.split('/joinchat/')[1];
    }
    
    return null;
  }
};