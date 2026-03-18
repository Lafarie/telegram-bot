# Telegram Bot Project

This project is a Telegram bot focused on AI chat and analytics actions.

## Features

- **Command Handling**: Responds to user commands like `/start` and `/help`.
- **Message Processing**: Handles incoming text messages and responds appropriately.
- **User Authentication**: Middleware to check user authentication before accessing certain features.
- **Rate Limiting**: Prevents abuse by limiting the rate of incoming messages.
- **AI-First Mode**: In private chat, AI chat is primary by default.
- **AI Analytics Actions**: Button shortcuts for analytics and sales revenue snapshots.

## Project Structure

```
telegram-bot
├── src
│   ├── bot.js                # Entry point of the bot application
│   ├── config
│   │   └── config.js         # Configuration settings for the bot
│   ├── handlers
│   │   ├── mediaHandler.js    # Manages media-related events
│   │   ├── commandHandler.js   # Processes bot commands
│   │   └── messageHandler.js   # Manages incoming text messages
│   ├── middleware
│   │   ├── authMiddleware.js   # User authentication middleware
│   │   └── rateLimitMiddleware.js # Rate limiting middleware
│   ├── services
│   │   ├── forwardingService.js # Logic for forwarding messages and media
│   │   ├── mediaService.js      # Manages media processing tasks
│   │   └── storageService.js    # Handles storage and retrieval of media files
│   └── utils
│       ├── logger.js            # Logging utility
│       └── helpers.js           # Various helper functions
├── .env.example                 # Template for environment variables
├── .gitignore                   # Files and directories to ignore by Git
├── package.json                 # npm configuration file
└── README.md                    # Documentation for the project
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd telegram-bot
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

3. Create a `.env` file based on the `.env.example` template and fill in the required environment variables.

4. Run the bot:
   ```
   pnpm start
   ```

## Usage

- Start the bot by sending the `/start` command.
- Ask any message directly in private chat to get AI response.
- Use the `/help` command to see and open operational button options.

## Connect To Claude

You cannot connect the bot to the claude.com product page directly.
Use Anthropic API credentials instead:

```env
AI_PROVIDER=anthropic
AI_BASE_URL=https://api.anthropic.com/v1
AI_API_KEY=sk-ant-your-anthropic-key
AI_MODEL=claude-3-5-sonnet-latest
AI_MAX_TOKENS=1024
AI_TIMEOUT_MS=30000
```

After updating your environment variables, restart the bot.

## AI Actions

From Help, open `AI Actions` to use quick buttons:

- Get All Analytics
- Sales Revenue 24h
- Sales Revenue 48h
- Sales Revenue 7d
- Top Products
- Orders Summary
- Conversion Report
- Refresh KPI Snapshot

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features you'd like to add.