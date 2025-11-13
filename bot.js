const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID // Channel where bot listens for commands
  },
  requestDelay: parseInt(process.env.REQUEST_DELAY) || 2000, // ms between requests
  gameCode: process.env.GAME_CODE || 'tskgb' // The Seven Deadly Sins: Grand Cross
};

const players = [
  {
    pid: '2132E04A57DA4FC397D773C4E2404473',
    accountName: 'akirasane',
    discordID: '199185330333679618'
  },
  // {
  //   pid: 'ANOTHER_PID_HERE',
  //   accountName: 'Player 2',
  //   discordID: '294669069586530324'
  // }
  // Add more players here
];

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
  console.log(`📊 Monitoring ${players.length} player(s)`);
  console.log(`🎮 Game: ${CONFIG.gameCode}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Only process messages from configured channel (if set)
  if (CONFIG.discord.channelId && message.channel.id !== CONFIG.discord.channelId) return;
  
  const content = message.content.trim();
  
  // Help command
  if (content === '!help' || content === '!commands') {
    await sendHelpMessage(message.channel);
    return;
  }
  
  // Redeem command
  if (content.startsWith('!redeem ')) {
    const couponCode = content.substring(8).trim().toUpperCase();
    
    if (!couponCode) {
      await message.reply('❌ Please provide a coupon code. Usage: `!redeem COUPONCODE`');
      return;
    }
    
    await redeemCouponForAll(message, couponCode);
    return;
  }
  
  // List players command
  if (content === '!players') {
    await listPlayers(message.channel);
    return;
  }
});

// ============================================================================
// Coupon Redemption
// ============================================================================

async function redeemCouponForAll(message, couponCode) {
  console.log(`Redeeming coupon ${couponCode} for all players...`);
  
  // Send initial message
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
  
  // Send results
  await sendRedemptionResults(message.channel, results, message.author.username);
  
  // Delete status message
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

async function sendHelpMessage(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 Coupon Redeemer Bot - Commands')
    .setDescription('Use these commands to redeem coupons for all registered players:')
    .setColor(0x0099ff)
    .addFields(
      {
        name: '!redeem <CODE>',
        value: 'Redeem a coupon code for all players\nExample: `!redeem FREEGEMS2024`',
        inline: false
      },
      {
        name: '!players',
        value: 'List all registered players',
        inline: false
      },
      {
        name: '!help',
        value: 'Show this help message',
        inline: false
      }
    )
    .setFooter({ text: `Currently monitoring ${players.length} player(s)` })
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
}

async function listPlayers(channel) {
  const playerList = players.map((p, i) => 
    `${i + 1}. **${p.accountName}** <@${p.discordID}>`
  ).join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle('👥 Registered Players')
    .setDescription(playerList || 'No players registered')
    .setColor(0x0099ff)
    .setFooter({ text: `Total: ${players.length} player(s)` })
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEmbedColor(results) {
  const allSuccess = results.every(r => r.success);
  const someSuccess = results.some(r => r.success);
  
  if (allSuccess) return 0x00ff00;  // Green
  if (someSuccess) return 0xffa500; // Orange
  return 0xff0000;                  // Red
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

// Handle errors
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
