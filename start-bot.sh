#!/usr/bin/env sh

set -u
cd -- "$(dirname -- "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed yet."
  echo "Install Node.js 22 or newer, then run this file again."
  echo "Download: https://nodejs.org/"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing. Install the full Node.js package, then try again."
  exit 1
fi

if [ ! -f "node_modules/discord.js/package.json" ]; then
  echo "Installing the bot packages for the first time..."
  npm install --omit=dev || {
    echo "Package installation failed. Check your internet connection and try again."
    exit 1
  }
fi

echo "Starting the Discord bot..."
echo "Press Ctrl+C to stop it."
echo
exec node index.js
