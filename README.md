# Netmarble Coupon Redeemer Discord Bot

A Discord bot that automatically redeems Netmarble game coupons for multiple players.

## Features

- ✅ Redeem coupons for multiple players with one command
- 🎮 Support for The Seven Deadly Sins: Grand Cross (easily configurable for other games)
- 📊 Beautiful Discord embeds showing redemption results
- 🎁 Displays rewards received from coupons
- 👥 Dynamic player management (add/remove players via commands)
- 🌐 Multi-server support (separate player lists per server)
- ⚡ Fast and reliable

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Discord Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" tab → "Add Bot"
4. **Important**: Enable "Message Content Intent" under Privileged Gateway Intents
5. Copy the bot token
6. Go to OAuth2 → URL Generator
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Messages/View Channels`, `Embed Links`, `Mention Everyone`
7. Use the generated URL to invite the bot to your server

### 3. Get Channel ID

1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click the channel where you want the bot to work
3. Click "Copy ID"

### 4. Configure Bot

Create a `.env` file (copy from `.env.example`):

```env
DISCORD_BOT_TOKEN=your_bot_token_here
# DISCORD_CHANNEL_ID=your_channel_id_here  # Optional: Leave commented for all channels
GAME_CODE=tskgb
REQUEST_DELAY=2000
```

**Note:** The bot now supports multiple servers! Each server has its own player list stored separately.

### 5. Run Bot

```bash
npm start
```

You should see:
```
✅ Bot is ready! Logged in as YourBot#1234
📊 Monitoring 2 player(s)
🎮 Game: tskgb
```

## Commands

### Player Management

- **`!addplayer <PID> <AccountName>`** - Add your player to this server
  ```
  !addplayer ABC123DEF456 MyGameAccount
  ```

- **`!removeplayer <PID>`** - Remove your player from this server
  ```
  !removeplayer ABC123DEF456
  ```

- **`!mypid`** - Show your registered player info

- **`!players`** - List all registered players in this server

### Coupon Redemption

- **`!redeem <CODE>`** - Redeem a coupon code for all registered players in this server
  ```
  !redeem FREEGEMS2024
  ```

### Other

- **`!help`** - Show available commands

## How to Get Player ID (PID)

1. Go to https://coupon.netmarble.com/tskgb
2. Open browser DevTools (F12)
3. Go to Network tab
4. Try to redeem any coupon
5. Look for the request to `/api/coupon/reward`
6. Check the URL parameters - the `pid` parameter is your Player ID

## Multi-Server Support

The bot automatically manages separate player lists for each Discord server:
- Players added in Server A won't appear in Server B
- Each server can have different players registered
- Player data is stored in `players.json` organized by server ID

## Changing Game

To use with other Netmarble games, change the `gameCode`:

- `tskgb` - The Seven Deadly Sins: Grand Cross
- `mherosgb` - Marvel Future Fight
- `a3` - A3: Still Alive
- etc.

## Troubleshooting

**Bot doesn't respond:**
- Make sure "Message Content Intent" is enabled in Discord Developer Portal
- Check if bot has permission to read/send messages in the channel
- Verify the bot token is correct

**"Invalid token" error:**
- Double-check your bot token in `bot.js`
- Make sure there are no extra spaces

**Coupon redemption fails:**
- Verify your Player IDs are correct
- Check if the coupon code is valid
- Some coupons may be region-locked or expired

## Running 24/7

To keep the bot running:

**Option 1: Using PM2 (Recommended)**
```bash
npm install -g pm2
pm2 start bot.js --name coupon-bot
pm2 save
pm2 startup
```

**Option 2: Using a hosting service**
- Heroku (free tier available)
- Railway.app
- Replit
- DigitalOcean

## Security

- Never share your bot token
- Keep your Player IDs private
- Don't commit sensitive data to public repositories

## License

MIT
