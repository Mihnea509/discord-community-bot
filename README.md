# Discord Custom Bot

A self-hosted Discord moderation and community bot for Windows and Linux.

## Install on Windows

1. Install the current **LTS** version of [Node.js](https://nodejs.org/).
2. Open this repository's **Releases** tab.
3. Download `discord-custom-bot-windows-v1.0.0.zip` from the newest release.
4. Extract the ZIP.
5. Double-click **`Start Discord Custom Bot.bat`**.
6. Paste your Discord bot token when asked.

The first start may take several minutes while packages install. **Do not close the window or stop it.** Wait for the login message or a clear error.

## Install on Linux

1. Install Node.js 22 or newer and npm. https://nodesource.com/products/distributions 
2. Open this repository's **Releases** tab.
3. Download and extract `discord-custom-bot-linux-v1.0.0.tar.gz`.
4. Open a terminal in the extracted folder.
5. Run:

```bash
chmod +x start-discord-custom-bot.sh
./start-discord-custom-bot.sh
```

6. Paste your Discord bot token when asked.

The first start may take several minutes while packages install. **Do not close the terminal or stop it.** Wait for the login message or a clear error.

## Discord setup

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Create an application and bot.
2. Copy its token.
3. Enable **Server Members Intent** and **Message Content Intent**.
4. Use **OAuth2 → URL Generator** with the `bot` scope.
5. Enable the **Administrator** permission for the bot.
6. Open the generated link to invite it to your server.

Discord Custom Bot needs Administrator permission because its moderation, tickets, verification, reaction roles, and channel-management commands must manage roles, messages, and channel access.

Once it is online, run `!help` in your server.

## Important

- The web dashboard is not included.
- Your token is stored locally in `.env` and ignored by Git.
- Never upload or share `.env`.
- Close the launcher window or press Ctrl+C to stop the bot.

## Updating

Download the newest release and keep a backup of your `.env` and runtime JSON files.

## License

[MIT licensed](LICENSE): you may use, modify, and share the code as long as the copyright and license notice remain included. The software comes without a warranty.
