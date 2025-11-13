const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID
  },
  requestDelay: parseInt(process.env.REQUEST_DELAY) || 2000,
  gameCode: process.env.GAME_CODE || 'tskgb',
  playersFile: path.join(__dirname, 'players.json')
};

// ============================================================================
// Player Data Management
// ============================================================================

function loadPlayers() {
  try {
    if (fs.existsSync(CONFIG.playersFile)) {
      const data = fs.readFileSync(CONFIG.playersFile, 'utf8');
      const loaded = JSON.parse(data);
      // Migrate old format to new format
      if (Array.isArray(loaded)) {
        return { 'default': loaded };
      }
      return loaded;
    }
  } catch (error) {
    console.error('Error loading players:', error.message);
  }
  return {};
}

function savePlayers(allPlayers) {
  try {
    fs.writeFileSync(CONFIG.playersFile, JSON.stringify(allPlayers, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving players:', error.message);
    return false;
  }
}

function getGuildPlayers(guildId) {
  return allPlayers[guildId] || [];
}

function setGuildPlayers(guildId, players) {
  allPlayers[guildId] = players;
}

let allPlayers = loadPlayers();

// ============================================================================
// Discord Bot Setup
// ============================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  const totalPlayers = Object.values(allPlayers).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`📊 Monitoring ${totalPlayers} player(s) across ${Object.keys(allPlayers).length} server(s)`);
  console.log(`🎮 Game: ${CONFIG.gameCode}`);
  console.log(`💾 Data file: ${CONFIG.playersFile}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (CONFIG.discord.channelId && message.channel.id !== CONFIG.discord.channelId) return;
  if (!message.guild) return; // Ignore DMs
  
  const content = message.content.trim();
  const guildId = message.guild.id;
  
  // Help command
  if (content === '!help' || content === '!commands') {
    await sendHelpMessage(message.channel, guildId);
    return;
  }
  
  // Redeem command
  if (content.startsWith('!redeem ')) {
    const couponCode = content.substring(8).trim().toUpperCase();
    if (!couponCode) {
      await message.reply('❌ Please provide a coupon code. Usage: `!redeem COUPONCODE`');
      return;
    }
    await redeemCouponForAll(message, couponCode, guildId);
    return;
  }
  
  // List players command
  if (content === '!players' || content === '!list') {
    await listPlayers(message.channel, guildId);
    return;
  }
  
  // Add player command
  if (content.startsWith('!addplayer ')) {
    await addPlayer(message, guildId);
    return;
  }
  
  // Remove player command
  if (content.startsWith('!removeplayer ')) {
    await removePlayer(message, guildId);
    return;
  }
  
  // My PID command
  if (content === '!mypid' || content === '!myplayer') {
    await showMyPlayer(message, guildId);
    return;
  }
});

// ============================================================================
// Player Management Commands
// ============================================================================

async function addPlayer(message, guildId) {
  const args = message.content.substring(11).trim().split(' ');
  
  if (args.length < 2) {
    await message.reply('❌ Usage: `!addplayer <PID> <AccountName>`\nExample: `!addplayer ABC123 MyAccount`');
    return;
  }
  
  const pid = args[0];
  const accountName = args.slice(1).join(' ');
  const discordID = message.author.id;
  
  const players = getGuildPlayers(guildId);
  
  // Check if PID already exists in this server
  const existingPlayer = players.find(p => p.pid === pid);
  if (existingPlayer) {
    await message.reply('❌ This PID is already registered in this server!');
    return;
  }
  
  // Add new player
  const newPlayer = {
    pid: pid,
    accountName: accountName,
    discordID: discordID,
    addedAt: new Date().toISOString()
  };
  
  players.push(newPlayer);
  setGuildPlayers(guildId, players);
  
  if (savePlayers(allPlayers)) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Player Added Successfully')
      .setColor(0x00ff00)
      .addFields(
        { name: 'Account Name', value: accountName, inline: true },
        { name: 'PID', value: pid, inline: true },
        { name: 'Discord User', value: `<@${discordID}>`, inline: true }
      )
      .setFooter({ text: `Total players in this server: ${players.length}` })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    console.log(`✅ Added player: ${accountName} (${pid}) for user ${message.author.tag} in guild ${guildId}`);
  } else {
    await message.reply('❌ Failed to save player data. Please try again.');
  }
}

async function removePlayer(message, guildId) {
  const args = message.content.substring(14).trim();
  
  if (!args) {
    await message.reply('❌ Usage: `!removeplayer <PID or @mention>`\nExample: `!removeplayer ABC123` or `!removeplayer @user`');
    return;
  }
  
  const discordID = message.author.id;
  const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
  
  let players = getGuildPlayers(guildId);
  let playerToRemove;
  
  // Check if it's a mention
  if (message.mentions.users.size > 0) {
    const mentionedUser = message.mentions.users.first();
    if (!isAdmin && mentionedUser.id !== discordID) {
      await message.reply('❌ You can only remove your own player!');
      return;
    }
    playerToRemove = players.find(p => p.discordID === mentionedUser.id);
  } else {
    // It's a PID
    playerToRemove = players.find(p => p.pid === args);
    if (playerToRemove && !isAdmin && playerToRemove.discordID !== discordID) {
      await message.reply('❌ You can only remove your own player!');
      return;
    }
  }
  
  if (!playerToRemove) {
    await message.reply('❌ Player not found in this server!');
    return;
  }
  
  // Remove player
  players = players.filter(p => p.pid !== playerToRemove.pid);
  setGuildPlayers(guildId, players);
  
  if (savePlayers(allPlayers)) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Player Removed')
      .setColor(0xff0000)
      .addFields(
        { name: 'Account Name', value: playerToRemove.accountName, inline: true },
        { name: 'PID', value: playerToRemove.pid, inline: true }
      )
      .setFooter({ text: `Total players in this server: ${players.length}` })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    console.log(`✅ Removed player: ${playerToRemove.accountName} (${playerToRemove.pid}) from guild ${guildId}`);
  } else {
    await message.reply('❌ Failed to save changes. Please try again.');
  }
}

async function showMyPlayer(message, guildId) {
  const discordID = message.author.id;
  const players = getGuildPlayers(guildId);
  const myPlayers = players.filter(p => p.discordID === discordID);
  
  if (myPlayers.length === 0) {
    await message.reply('❌ You don\'t have any players registered in this server!\nUse `!addplayer <PID> <AccountName>` to add one.');
    return;
  }
  
  const playerList = myPlayers.map((p, i) => 
    `**${i + 1}. ${p.accountName}**\nPID: \`${p.pid}\`\nAdded: ${new Date(p.addedAt).toLocaleDateString()}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setTitle('👤 Your Players')
    .setDescription(playerList)
    .setColor(0x0099ff)
    .setFooter({ text: `Total: ${myPlayers.length} player(s)` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
}

// ============================================================================
// Coupon Redemption
// ============================================================================

async function redeemCouponForAll(message, couponCode, guildId) {
  const players = getGuildPlayers(guildId);
  
  if (players.length === 0) {
    await message.reply('❌ No players registered in this server! Use `!addplayer <PID> <AccountName>` to add a player.');
    return;
  }
  
  console.log(`Redeeming coupon ${couponCode} for ${players.length} player(s) in guild ${guildId}...`);
  
  const statusMsg = await message.reply(`🔄 Redeeming coupon **${couponCode}** for ${players.length} player(s)...`);
  
  const results = [];
  
  for (const player of players) {
    await sleep(CONFIG.requestDelay);
    
    try {
      const result = await redeemCoupon(player.pid, couponCode);
      results.push({
        player: player.accountName,
        discordID: player.discordID,
        code: couponCode,
        success: result.success,
        message: result.message,
        rewards: result.rewards
      });
      
      console.log(`${player.accountName} - ${couponCode}: ${result.message}`);
      
    } catch (error) {
      results.push({
        player: player.accountName,
        discordID: player.discordID,
        code: couponCode,
        success: false,
        message: `Error: ${error.message}`,
        rewards: null
      });
      console.error(`${player.accountName} - ${couponCode}: Error - ${error.message}`);
    }
  }
  
  await sendRedemptionResults(message.channel, results, message.author.username);
  
  try {
    await statusMsg.delete();
  } catch (e) {
    // Ignore if can't delete
  }
}

async function redeemCoupon(pid, couponCode) {
  const url = `https://coupon.netmarble.com/api/coupon/reward?gameCode=${CONFIG.gameCode}&couponCode=${couponCode}&langCd=EN_US&pid=${pid}`;
  
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache, no-store',
    'dnt': '1',
    'pragma': 'no-cache',
    'referer': `https://coupon.netmarble.com/${CONFIG.gameCode}`,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
  };
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    const data = await response.json();
    
    if (response.ok && data.resultCode === '0000') {
      return {
        success: true,
        message: data.resultMsg || 'Coupon redeemed successfully',
        rewards: data.rewardList || null
      };
    } else {
      return {
        success: false,
        message: data.resultMsg || `Error code: ${data.resultCode}`,
        rewards: null
      };
    }
    
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// ============================================================================
// Discord Messages
// ============================================================================

async function sendRedemptionResults(channel, results, requestedBy) {
  const fields = [];
  
  results.forEach(result => {
    const emoji = result.success ? '✅' : '❌';
    let value = `${emoji} ${result.message}`;
    
    if (result.rewards && result.rewards.length > 0) {
      const rewardText = result.rewards
        .map(r => `${r.itemName} x${r.itemCnt}`)
        .join(', ');
      value += `\n*${rewardText}*`;
    }
    
    fields.push({
      name: `${result.player} <@${result.discordID}>`,
      value: value,
      inline: false
    });
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const couponCode = results[0].code;
  
  const embed = new EmbedBuilder()
    .setTitle(`🎟️ Coupon: ${couponCode}`)
    .setDescription(`✨ Redeemed ${successCount}/${totalCount} successfully\nRequested by: ${requestedBy}`)
    .setColor(getEmbedColor(results))
    .addFields(fields)
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
}

async function sendHelpMessage(channel, guildId) {
  const players = getGuildPlayers(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 Coupon Redeemer Bot - Commands')
    .setDescription('Use these commands to manage players and redeem coupons:')
    .setColor(0x0099ff)
    .addFields(
      {
        name: '📝 Player Management',
        value: '`!addplayer <PID> <Name>` - Add a player (can add multiple)\n`!removeplayer <PID>` - Remove a player by PID\n`!mypid` - Show your players\n`!players` - List all players in server',
        inline: false
      },
      {
        name: '🎟️ Coupon Commands',
        value: '`!redeem <CODE>` - Redeem coupon for all players\nExample: `!redeem FREEGEMS2024`',
        inline: false
      },
      {
        name: '❓ Other',
        value: '`!help` - Show this message',
        inline: false
      }
    )
    .setFooter({ text: `Currently ${players.length} player(s) registered in this server` })
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
}

async function listPlayers(channel, guildId) {
  const players = getGuildPlayers(guildId);
  
  if (players.length === 0) {
    await channel.send('❌ No players registered in this server yet! Use `!addplayer <PID> <AccountName>` to add one.');
    return;
  }
  
  const playerList = players.map((p, i) => 
    `${i + 1}. **${p.accountName}** <@${p.discordID}>\n   PID: \`${p.pid}\``
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setTitle('👥 Registered Players')
    .setDescription(playerList)
    .setColor(0x0099ff)
    .setFooter({ text: `Total: ${players.length} player(s) in this server` })
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEmbedColor(results) {
  const allSuccess = results.every(r => r.success);
  const someSuccess = results.some(r => r.success);
  
  if (allSuccess) return 0x00ff00;
  if (someSuccess) return 0xffa500;
  return 0xff0000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Start Bot
// ============================================================================

client.login(CONFIG.discord.token).catch(error => {
  console.error('❌ Failed to login:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
