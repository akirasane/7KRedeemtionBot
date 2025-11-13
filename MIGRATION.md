# Migration Guide

## Multi-Server Support Update

The bot now supports multiple Discord servers with separate player lists for each server.

### What Changed?

**Old Format (players.json):**
```json
[
  {
    "pid": "ABC123",
    "accountName": "Player1",
    "discordID": "123456"
  }
]
```

**New Format (players.json):**
```json
{
  "1234567890": [
    {
      "pid": "ABC123",
      "accountName": "Player1",
      "discordID": "123456",
      "addedAt": "2025-11-13T05:50:14.598Z"
    }
  ],
  "9876543210": [
    {
      "pid": "DEF456",
      "accountName": "Player2",
      "discordID": "654321",
      "addedAt": "2025-11-13T06:00:00.000Z"
    }
  ]
}
```

### Automatic Migration

The bot will **automatically migrate** your existing `players.json` file when you start it:
- Old array format → New object format with `"default"` key
- No manual action required
- Your existing player data is preserved

### Benefits

- Each Discord server has its own player list
- Players can use the bot on multiple servers without conflicts
- Better organization and data separation
