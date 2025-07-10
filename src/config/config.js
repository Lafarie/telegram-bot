module.exports = {
  // Bot Configuration
  bot: {
    token: process.env.BOT_TOKEN || "YOUR_TELEGRAM_BOT_TOKEN",
    adminId: process.env.ADMIN_ID || "YOUR_ADMIN_ID"
  },

  // API Configuration
  api: {
    telegramApiUrl: "https://api.telegram.org/bot",
    mediaUploadUrl: "https://api.telegram.org/file/bot"
  },

  // Media Configuration
  media: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024, // 20 MB
    allowedFileTypes: ["image/jpeg", "image/png", "video/mp4", "audio/mpeg"]
  },

  // Middleware Configuration
  middleware: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    logFilePath: process.env.LOG_FILE_PATH || "./logs/bot.log"
  }
};