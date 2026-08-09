# Discord Community Bot

A self-hosted Discord community and moderation bot for Windows and Linux. It includes moderation, warnings, reaction roles, verification, welcome messages, tickets with transcripts, logging, channel controls, and DISBOARD bump reminders.

This public edition has no web dashboard. Everything is managed safely through Discord commands.

## Windows: easiest installation

### 1. Install Node.js

Download and install the current **LTS** version from [nodejs.org](https://nodejs.org/). Keep the normal installation options enabled.

### 2. Download the bot

Open the repository's **Releases** tab, choose the newest release, and download `discord-community-bot-windows-v1.0.0.zip`. Extract the ZIP and open the extracted folder.

Do not use GitHub's **Code → Download ZIP** button if you only want the ready-to-run Windows package. The Releases ZIP already contains the correct Windows launcher.

### 3. Start it

Double-click **`Start Bot.bat`**.

The launcher automatically installs the required packages the first time. If no token has been saved yet, it asks you to paste your Discord bot token. The token is saved only in a local `.env` file and will not be uploaded by Git because `.gitignore` excludes it.

Keep the launcher window open while you want the bot online. Close it to stop the bot.

After the first launch, starting the bot is always the same: double-click **`Start Bot.bat`**.

## Create and configure a Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application** and choose a name.
3. Open **Bot**, create the bot, and reset/copy its token.
4. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
5. Open **OAuth2 → URL Generator**.
6. Select the `bot` scope.
7. Give it the permissions required by the features you intend to use. Administrator is easiest for a private bot you control; carefully selected permissions are safer for a public deployment.
8. Open the generated URL and invite the bot to your server.

Never publish your token. If it is exposed anywhere, reset it immediately in the Developer Portal.

## First command

Once the launcher says `Logged in as ...`, use:

```text
!help
```

Administrators see the complete command list. Regular members only see commands they can use.

## Updating

If you downloaded a ZIP, download the newest ZIP and copy your existing `.env` file and runtime JSON files into the new folder.

If you cloned with Git, stop the bot and run:

```powershell
git pull
npm install --omit=dev
```

Then double-click `Start Bot.bat` again.

## Starting from a terminal

The launcher is optional. The equivalent commands are:

```powershell
npm install --omit=dev
npm start
```

The first interactive start asks for a token if `.env` does not already contain one.

## Local files

The bot creates JSON files for server settings, warnings, tickets, reaction roles, and other runtime data. These files and `.env` are ignored by Git so one installation cannot accidentally publish private configuration.

Back up `.env`, the runtime JSON files, and the `data` folder before replacing or moving an installation.

## Linux: easiest installation

1. Install Node.js 22 or newer and npm using your distribution's package manager or [NodeSource](https://github.com/nodesource/distributions).
2. Open the repository's **Releases** tab and download `discord-community-bot-linux-v1.0.0.tar.gz` from the newest release.
3. Extract the Linux archive.
4. Open a terminal inside the extracted folder.
5. Make the launcher executable once:

```bash
chmod +x start-bot.sh
```

6. Start the bot:

```bash
./start-bot.sh
```

The launcher installs the required packages automatically on its first run. If no token is cached, it asks for one and stores it only in the ignored local `.env` file.

After setup, run `./start-bot.sh` whenever you want to start the bot. For an always-on server or Raspberry Pi, a process manager such as PM2 can run `index.js`.

## License

Released under the [MIT License](LICENSE).
