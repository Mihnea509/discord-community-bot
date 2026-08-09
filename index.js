import { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js'; // added EmbedBuilder
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import colorNames from 'color-name';


dotenv.config();
const appRoot = dirname(fileURLToPath(import.meta.url));
const botInstance = String(process.env.BOT_INSTANCE ?? 'public').toLowerCase();
if (!/^[a-z0-9-]+$/.test(botInstance)) throw new Error('BOT_INSTANCE may only contain letters, numbers, and hyphens.');
const botName = process.env.BOT_NAME ?? (botInstance === 'avril' ? 'Avril' : 'Discord Custom Bot');
// The default public installation stores data beside the app. Named extra instances are isolated.
const dataRoot = botInstance === 'public' ? appRoot : join(appRoot, 'data', botInstance);
await mkdir(dataRoot, { recursive: true });
const gameSessions = new Map(); // Stores active games: userId => number
const funReplies = botInstance === 'avril' ? new Map() : new Map([
  ['!pat', '*purr* U//U'],
  ['!poke', 'Ouchie'],
  ['!tickle', 'HahahahahhaahahHAHAHAHAHA STOP.'],
  ['!lick', '(⁠ ⁠≧⁠Д⁠≦⁠)'],
  ['!nibble', "I'm not edible, you!"],
]);
const reactionRolesFile = join(dataRoot, 'reaction-roles.json');
const welcomeConfigFile = join(dataRoot, 'welcome-config.json');
const commandRestrictionsFile = join(dataRoot, 'command-restrictions.json');
const hiddenChannelsFile = join(dataRoot, 'hidden-channels.json');
const warningsFile = join(dataRoot, 'warnings.json');
const ticketConfigsFile = join(dataRoot, 'ticket-config.json');
const ticketsFile = join(dataRoot, 'tickets.json');
const logConfigsFile = join(dataRoot, 'log-config.json');
const moderationStateFile = join(dataRoot, 'moderation-state.json');
const bumpConfigsFile = join(dataRoot, 'bump-config.json');
const ticketTranscriptsFile = join(dataRoot, 'ticket-transcripts.json');
const ticketTranscriptsDirectory = join(dataRoot, 'ticket-transcripts');
await mkdir(ticketTranscriptsDirectory, { recursive: true });
const activeReactionRoleWizards = new Set();
const channelsBeingCleared = new Set();
const ticketsBeingCreated = new Set();
let reactionRolePanels = {};
let welcomeConfigs = {};
let commandRestrictions = {};
let hiddenChannels = {};
let warnings = {};
let ticketConfigs = {};
let tickets = {};
let logConfigs = {};
let moderationState = {};
let bumpConfigs = {};
let ticketTranscripts = [];

try {
  reactionRolePanels = JSON.parse(await readFile(reactionRolesFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load reaction-role panels:', error);
}

try {
  welcomeConfigs = JSON.parse(await readFile(welcomeConfigFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load welcome configurations:', error);
}

try {
  commandRestrictions = JSON.parse(await readFile(commandRestrictionsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load command restrictions:', error);
}

try {
  hiddenChannels = JSON.parse(await readFile(hiddenChannelsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load hidden channels:', error);
}

try {
  warnings = JSON.parse(await readFile(warningsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load warnings:', error);
}

try {
  ticketConfigs = JSON.parse(await readFile(ticketConfigsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load ticket configurations:', error);
}

try {
  tickets = JSON.parse(await readFile(ticketsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load tickets:', error);
}

try {
  logConfigs = JSON.parse(await readFile(logConfigsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load moderation log configurations:', error);
}

try {
  moderationState = JSON.parse(await readFile(moderationStateFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load moderation state:', error);
}

try {
  bumpConfigs = JSON.parse(await readFile(bumpConfigsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load bump configurations:', error);
}

try {
  ticketTranscripts = JSON.parse(await readFile(ticketTranscriptsFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not load ticket transcripts:', error);
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

const DISBOARD_BOT_ID = '302050872383242240';
const DISBOARD_BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const bumpReminderTimers = new Map();

function bumpDelayText() {
  return '2 hours';
}

async function sendBumpReminder(guildId) {
  const config = bumpConfigs[guildId];
  if (!config?.channelId || !config.nextReminderAt) return;
  const remaining = config.nextReminderAt - Date.now();
  if (remaining > 1_000) {
    scheduleBumpReminder(guildId);
    return;
  }
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(config.channelId)
    ?? await guild?.channels.fetch(config.channelId).catch(() => null);
  if (channel?.isTextBased() && channel.isSendable()) {
    await channel.send(`⏰ **Bump reminder!** DISBOARD's 2-hour cooldown has expired. Someone can use \`/bump\` now.`);
  }
  config.nextReminderAt = null;
  await saveBumpConfigs();
  bumpReminderTimers.delete(guildId);
}

function scheduleBumpReminder(guildId) {
  const existing = bumpReminderTimers.get(guildId);
  if (existing) clearTimeout(existing);
  const config = bumpConfigs[guildId];
  if (!config?.nextReminderAt) return;
  const delay = Math.max(1_000, Math.min(config.nextReminderAt - Date.now(), 2_147_000_000));
  const timer = setTimeout(() => {
    void sendBumpReminder(guildId).catch(error => console.error('Could not send bump reminder:', error));
  }, delay);
  bumpReminderTimers.set(guildId, timer);
}

async function recordSuccessfulBump(message) {
  const config = bumpConfigs[message.guild.id];
  if (!config || config.channelId !== message.channel.id) return;
  const combinedText = [
    message.content,
    ...message.embeds.flatMap(embed => [embed.title, embed.description, ...(embed.fields ?? []).flatMap(field => [field.name, field.value])]),
  ].filter(Boolean).join(' ');
  if (!/\bbump\s*(?:done|successful|complete(?:d)?)\b|\bsuccessfully\s+bumped\b/i.test(combinedText)) return;

  const bumpUser = message.interactionMetadata?.user ?? message.interaction?.user ?? null;
  config.nextReminderAt = Date.now() + DISBOARD_BUMP_COOLDOWN_MS;
  config.lastBumpedBy = bumpUser?.id ?? null;
  config.lastBumpedAt = Date.now();
  await saveBumpConfigs();
  scheduleBumpReminder(message.guild.id);
  await message.channel.send({
    content: `${bumpUser ? `${bumpUser} ` : ''}Thanks for bumping! ${botName} automatically detected the successful DISBOARD bump and will remind you again in **${bumpDelayText()}**.`,
    allowedMentions: { users: bumpUser ? [bumpUser.id] : [] },
  });
}

// Utility function to find user by mention or username
async function findUser(message, input) {
  if (!input) return null;
  const mention = message.mentions.members.first();
  if (mention) return mention;

  const cleanInput = input.trim();
  const search = cleanInput.toLowerCase();
  const cachedMember = message.guild.members.cache.find(member =>
    member.id === cleanInput ||
    member.user.username.toLowerCase() === search ||
    member.displayName.toLowerCase() === search ||
    member.user.globalName?.toLowerCase() === search
  );

  if (cachedMember) return cachedMember;

  // Fetching one member by ID uses Discord's REST API and avoids the
  // rate-limited gateway request caused by fetching the full member list.
  if (/^\d{17,20}$/.test(cleanInput)) {
    return message.guild.members.fetch(cleanInput).catch(() => null);
  }

  // Search Discord for an uncached member by username or server nickname.
  // This is targeted and does not download the server's full member list.
  const foundMembers = await message.guild.members
    .search({ query: cleanInput, limit: 100 })
    .catch(() => null);

  if (!foundMembers) return null;

  return foundMembers.find(member =>
    member.user.username.toLowerCase() === search ||
    member.displayName.toLowerCase() === search ||
    member.user.globalName?.toLowerCase() === search
  ) ?? null;

}

// Allow the server owner and members whose roles grant Administrator access.
function canUseModerationCommands(message) {
  return message.member.id === message.guild.ownerId ||
    message.member.permissions.has(PermissionFlagsBits.Administrator);
}

// Find the Muted role, or create and configure it if it does not exist.
async function getOrCreateMutedRole(guild) {
  let mutedRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
  if (mutedRole) return mutedRole;

  mutedRole = await guild.roles.create({
    name: 'Muted',
    reason: 'Automatically created for the mute command',
  });

  const channels = await guild.channels.fetch();
  await Promise.allSettled(
    channels
      .filter(channel => channel)
      .map(channel => channel.permissionOverwrites.edit(mutedRole, {
        SendMessages: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        AddReactions: false,
        Speak: false,
      }))
  );

  return mutedRole;
}

async function saveReactionRolePanels() {
  await writeFile(reactionRolesFile, JSON.stringify(reactionRolePanels, null, 2), 'utf8');
}

async function saveWelcomeConfigs() {
  await writeFile(welcomeConfigFile, JSON.stringify(welcomeConfigs, null, 2), 'utf8');
}

async function saveCommandRestrictions() {
  await writeFile(commandRestrictionsFile, JSON.stringify(commandRestrictions, null, 2), 'utf8');
}

async function saveHiddenChannels() {
  await writeFile(hiddenChannelsFile, JSON.stringify(hiddenChannels, null, 2), 'utf8');
}

async function saveWarnings() {
  await writeFile(warningsFile, JSON.stringify(warnings, null, 2), 'utf8');
}

async function saveTicketConfigs() {
  await writeFile(ticketConfigsFile, JSON.stringify(ticketConfigs, null, 2), 'utf8');
}

async function saveTickets() {
  await writeFile(ticketsFile, JSON.stringify(tickets, null, 2), 'utf8');
}

async function saveLogConfigs() {
  await writeFile(logConfigsFile, JSON.stringify(logConfigs, null, 2), 'utf8');
}

async function saveModerationState() {
  await writeFile(moderationStateFile, JSON.stringify(moderationState, null, 2), 'utf8');
}

async function saveBumpConfigs() {
  await writeFile(bumpConfigsFile, JSON.stringify(bumpConfigs, null, 2), 'utf8');
}

async function saveTicketTranscripts() {
  await writeFile(ticketTranscriptsFile, JSON.stringify(ticketTranscripts, null, 2), 'utf8');
}

function ticketActorName(actor) {
  if (typeof actor === 'string') return actor;
  return actor?.displayName ?? actor?.user?.username ?? actor?.username ?? 'Unknown user';
}

function ticketActorId(actor) {
  return typeof actor === 'string' ? '' : actor?.id ?? actor?.user?.id ?? '';
}

async function createTicketTranscript(channel, ticket, closedBy) {
  if (!channel?.isTextBased()) throw new Error('The ticket channel is unavailable, so its transcript cannot be created.');
  const messages = [];
  let before;
  while (true) {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    messages.push(...page.values());
    if (page.size < 100) break;
    before = page.lastKey();
    if (!before) break;
  }

  const entries = messages.map(message => {
    const parts = [];
    if (message.content) parts.push(message.content);
    for (const attachment of message.attachments.values()) parts.push(`[Attachment: ${attachment.name ?? 'file'}] ${attachment.url}`);
    for (const embed of message.embeds) {
      const embedText = [embed.title, embed.description, ...(embed.fields ?? []).flatMap(field => [`${field.name}: ${field.value}`])]
        .filter(Boolean).join(' | ');
      if (embedText) parts.push(`[Embed] ${embedText}`);
    }
    for (const sticker of message.stickers.values()) parts.push(`[Sticker: ${sticker.name}]`);
    const authorName = message.member?.displayName ?? message.author.globalName ?? message.author.username;
    return {
      at: message.createdTimestamp,
      text: `[${new Date(message.createdTimestamp).toISOString()}] ${authorName} (@${message.author.username}, ${message.author.id}): ${parts.join('\n') || '[No text content]'}`,
    };
  });

  for (const event of ticket.events ?? []) {
    if (event.type === 'claimed') {
      entries.push({ at: event.at, text: `[${new Date(event.at).toISOString()}] TICKET CLAIMED BY ${event.byName} (${event.byId})` });
    } else if (event.type === 'unassigned') {
      entries.push({ at: event.at, text: `[${new Date(event.at).toISOString()}] TICKET UNASSIGNED FROM DASHBOARD` });
    }
  }
  const closedAt = Date.now();
  const closedByName = ticketActorName(closedBy);
  const closedById = ticketActorId(closedBy);
  entries.push({
    at: closedAt,
    text: `[${new Date(closedAt).toISOString()}] TICKET CLOSED BY ${closedByName}${closedById ? ` (${closedById})` : ''}`,
  });
  entries.sort((a, b) => a.at - b.at);

  const id = `${channel.id}-${closedAt}`;
  const fileName = `${id}.txt`;
  const header = [
    `${botName.toUpperCase()} TICKET TRANSCRIPT`,
    `Server: ${channel.guild.name} (${channel.guild.id})`,
    `Channel: #${channel.name} (${channel.id})`,
    `Ticket owner ID: ${ticket.ownerId}`,
    `Opened: ${ticket.createdAt ? new Date(ticket.createdAt).toISOString() : 'Unknown'}`,
    `Closed: ${new Date(closedAt).toISOString()}`,
    `Messages: ${messages.length}`,
    '='.repeat(80),
    '',
  ].join('\n');
  await writeFile(join(ticketTranscriptsDirectory, fileName), `${header}${entries.map(entry => entry.text).join('\n\n')}\n`, 'utf8');
  const transcript = {
    id,
    fileName,
    guildId: channel.guild.id,
    channelId: channel.id,
    channelName: channel.name,
    ownerId: ticket.ownerId,
    claimedBy: ticket.claimedBy ?? null,
    closedBy: closedByName,
    createdAt: ticket.createdAt ?? null,
    closedAt,
    messageCount: messages.length,
  };
  ticketTranscripts.unshift(transcript);
  await saveTicketTranscripts();
  return transcript;
}

async function readTicketTranscript(id, guildId) {
  const transcript = ticketTranscripts.find(item => item.id === id && item.guildId === guildId);
  if (!transcript) return null;
  return { transcript, contents: await readFile(join(ticketTranscriptsDirectory, transcript.fileName), 'utf8') };
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${seconds}s`].filter(Boolean).join(' ');
}

async function sendModerationLog(guild, { action, target, moderator, reason = '', occurredAt = Date.now(), duration = '' }) {
  const channelId = logConfigs[guild.id]?.channelId;
  if (!channelId) return;
  try {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    const unixTime = Math.floor(occurredAt / 1000);
    const color = ['Unmuted', 'Warnings reset', 'Ticket assigned', 'Commands enabled', 'Channel unlocked', 'Channel shown'].includes(action)
      ? 0x57f287
      : ['Warned', 'Ticket unassigned', 'Commands disabled', 'Channel locked', 'Channel hidden'].includes(action)
        ? 0xfee75c
        : action === 'Ticket created' ? 0x5865f2 : 0xed4245;
    const embed = new EmbedBuilder()
      .setTitle(`Moderation log — ${action}`)
      .setColor(color)
      .addFields(
        { name: target?.isTextBased?.() ? 'Channel' : 'Member', value: `${target} (${target.user?.tag ?? target.tag ?? target.id})` },
        { name: 'Action', value: action, inline: true },
        { name: 'Performed by', value: moderator?.toString?.() ?? String(moderator), inline: true },
        { name: 'Exact time', value: `<t:${unixTime}:F>`, inline: false },
        { name: 'Timer', value: `<t:${unixTime}:R>`, inline: true },
      )
      .setTimestamp(occurredAt);
    if (reason) embed.addFields({ name: action === 'Unmuted' ? 'Message' : 'Reason', value: reason.slice(0, 1024) });
    if (duration) embed.addFields({ name: 'Mute duration', value: duration, inline: true });
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Could not send moderation log:', error);
  }
}

function getVerificationRoleIds(guildId) {
  return [...new Set(
    Object.values(reactionRolePanels)
      .filter(panel => panel.guildId === guildId && panel.type === 'verification')
      .flatMap(panel => Object.values(panel.roles))
  )];
}

function reactionEmojiKey(emoji) {
  return emoji.id ?? emoji.name;
}

function inputEmojiKey(input) {
  const customEmoji = input.match(/^<a?:\w+:(\d+)>$/);
  return customEmoji?.[1] ?? input;
}

function parseHtmlColor(input) {
  if (/^#?[0-9a-f]{6}$/i.test(input)) {
    return Number.parseInt(input.replace('#', ''), 16);
  }

  const normalizedName = input.toLowerCase().replace(/[\s_-]/g, '');
  const rgb = colorNames[normalizedName];
  return rgb ? (rgb[0] << 16) | (rgb[1] << 8) | rgb[2] : null;
}

function findChannel(guild, input) {
  const channelId = input.match(/^<#(\d+)>$/)?.[1] ?? (/^\d+$/.test(input) ? input : null);
  if (channelId) return guild.channels.cache.get(channelId) ?? null;
  const name = input.replace(/^#/, '').toLowerCase();
  return guild.channels.cache.find(channel => channel.name?.toLowerCase() === name) ?? null;
}

function findRole(guild, input) {
  const roleId = input.match(/^<@&(\d+)>$/)?.[1] ?? (/^\d+$/.test(input) ? input : null);
  if (roleId) return guild.roles.cache.get(roleId) ?? null;
  const name = input.replace(/^@/, '').toLowerCase();
  return guild.roles.cache.find(role => role.name.toLowerCase() === name) ?? null;
}

async function askWizardQuestion(
  message,
  question,
  { timeoutMs = 120_000, cancelCaseSensitive = false } = {}
) {
  await message.channel.send(question);
  const collectorOptions = {
    filter: reply => reply.author.id === message.author.id,
    max: 1,
  };
  if (timeoutMs !== null) {
    collectorOptions.time = timeoutMs;
    collectorOptions.errors = ['time'];
  }

  const replies = await message.channel.awaitMessages(collectorOptions).catch(() => null);
  if (!replies) throw new Error('WIZARD_TIMEOUT');
  const answer = replies.first().content.trim();
  const shouldCancel = cancelCaseSensitive ? answer === 'CANCEL' : answer.toLowerCase() === 'cancel';
  if (shouldCancel) throw new Error('WIZARD_CANCELLED');
  return answer;
}

async function runReactionRoleWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a reaction-role wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Reaction-role wizard started! Type `cancel` at any step to stop.');

    const channelInput = await askWizardQuestion(
      message,
      '**1/5 — Channel:** Mention the channel where the panel should be posted, such as `#roles`.',
      { timeoutMs: null, cancelCaseSensitive: true }
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send messages in. Please run the wizard again.');
    }

    const title = await askWizardQuestion(
      message,
      '**2/5 — Title:** What should the panel title be?',
      { timeoutMs: null, cancelCaseSensitive: true }
    );
    const descriptionInput = await askWizardQuestion(
      message,
      '**3/5 — Description:** Enter the instructions shown on the panel, or type `skip`.',
      { timeoutMs: null, cancelCaseSensitive: true }
    );
    const description = descriptionInput.toLowerCase() === 'skip'
      ? 'React below to add or remove a role.'
      : descriptionInput;

    const colorInput = await askWizardQuestion(
      message,
      '**4/5 — Color:** Enter a hex color such as `#84fc03`, or an HTML color name such as `CornflowerBlue` or `hot pink`.',
      { timeoutMs: null, cancelCaseSensitive: true }
    );
    const color = parseHtmlColor(colorInput);
    if (color === null) {
      return message.reply('That is not a valid six-digit hex code or HTML color name. Please run the wizard again.');
    }

    const mappingsInput = await askWizardQuestion(
      message,
      '**5/5 — Emoji and roles:** Put one pair on each line using `emoji | role`.\n' +
      'Example:\n🎮 | Gamer\n🎨 | Artist\n\nYou can mention roles or use their exact names.',
      { timeoutMs: null, cancelCaseSensitive: true }
    );

    const botMember = message.guild.members.me;
    const mappings = [];
    for (const line of mappingsInput.split(/\r?\n/).filter(Boolean)) {
      const separator = line.indexOf('|');
      if (separator === -1) {
        return message.reply(`Invalid line: \`${line}\`. Use \`emoji | role\`.`);
      }

      const emoji = line.slice(0, separator).trim();
      const roleInput = line.slice(separator + 1).trim();
      const role = findRole(message.guild, roleInput);
      if (!emoji || !role) return message.reply(`I could not find the emoji or role in: \`${line}\`.`);
      if (role.id === message.guild.id || role.managed || role.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(`The role **${role.name}** cannot be self-assigned.`);
      }
      if (role.position >= botMember.roles.highest.position) {
        return message.reply(`Move my bot role above **${role.name}**, then run the wizard again.`);
      }
      if (mappings.some(mapping => mapping.emojiKey === inputEmojiKey(emoji))) {
        return message.reply(`The emoji ${emoji} was used more than once.`);
      }

      mappings.push({ emoji, emojiKey: inputEmojiKey(emoji), roleId: role.id, roleName: role.name });
    }

    if (!mappings.length || mappings.length > 20) {
      return message.reply('Please provide between 1 and 20 emoji-role pairs.');
    }

    const embed = new EmbedBuilder()
      .setTitle(title.slice(0, 256))
      .setDescription(`${description.slice(0, 1800)}\n\n${mappings.map(item => `${item.emoji} — **${item.roleName}**`).join('\n')}`)
      .setColor(color)
      .setFooter({ text: 'React to add a role • Remove your reaction to remove it' });

    const panelMessage = await targetChannel.send({ embeds: [embed] });
    try {
      for (const mapping of mappings) await panelMessage.react(mapping.emoji);
    } catch (error) {
      await panelMessage.delete().catch(() => {});
      return message.reply('I could not use one of those emojis. Check the emojis and my Add Reactions permission.');
    }

    reactionRolePanels[panelMessage.id] = {
      guildId: message.guild.id,
      channelId: targetChannel.id,
      roles: Object.fromEntries(mappings.map(item => [item.emojiKey, item.roleId])),
    };
    await saveReactionRolePanels();
    await message.reply(`Your reaction-role panel was created in ${targetChannel}.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Reaction-role wizard cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!reactionrolesetup` to start again.');
    } else {
      console.error('Reaction-role wizard error:', error);
      await message.reply('Something went wrong while creating the panel. Check my permissions and try again.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runReactionRoleAddWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Reaction-role editing started! Type `cancel` at any step to stop.');

    const messageInput = await askWizardQuestion(
      message,
      '**1/2 — Message ID:** Enter the message ID of the reaction-role panel you want to edit.'
    );
    const panelMessageId = messageInput.match(/\d{17,20}/)?.[0];
    const panel = panelMessageId ? reactionRolePanels[panelMessageId] : null;
    if (!panel || panel.guildId !== message.guild.id || panel.type === 'verification') {
      return message.reply('I could not find a saved reaction-role panel with that message ID in this server.');
    }

    const panelChannel = message.guild.channels.cache.get(panel.channelId)
      ?? await message.guild.channels.fetch(panel.channelId);
    if (!panelChannel?.isTextBased()) {
      return message.reply('The channel containing that panel no longer exists.');
    }

    const panelMessage = await panelChannel.messages.fetch(panelMessageId).catch(() => null);
    if (!panelMessage || !panelMessage.embeds.length) {
      return message.reply('The reaction-role message no longer exists or no longer has an embed.');
    }

    const mappingsInput = await askWizardQuestion(
      message,
      '**2/2 — New emoji and roles:** Put one new pair on each line using `emoji | role`.\n' +
      'Example:\n🎵 | Music\n🎮 | Gamer\n\nYou can mention roles or use their exact names.'
    );

    const botMember = message.guild.members.me;
    const newMappings = [];
    for (const line of mappingsInput.split(/\r?\n/).filter(Boolean)) {
      const separator = line.indexOf('|');
      if (separator === -1) return message.reply(`Invalid line: \`${line}\`. Use \`emoji | role\`.`);

      const emoji = line.slice(0, separator).trim();
      const roleInput = line.slice(separator + 1).trim();
      const role = findRole(message.guild, roleInput);
      const emojiKey = inputEmojiKey(emoji);

      if (!emoji || !role) return message.reply(`I could not find the emoji or role in: \`${line}\`.`);
      if (role.id === message.guild.id || role.managed || role.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(`The role **${role.name}** cannot be self-assigned.`);
      }
      if (role.position >= botMember.roles.highest.position) {
        return message.reply(`Move my bot role above **${role.name}**, then run the wizard again.`);
      }
      if (panel.roles[emojiKey] || newMappings.some(mapping => mapping.emojiKey === emojiKey)) {
        return message.reply(`The emoji ${emoji} is already used on this panel.`);
      }

      newMappings.push({ emoji, emojiKey, roleId: role.id, roleName: role.name });
    }

    const existingCount = Object.keys(panel.roles).length;
    if (!newMappings.length || existingCount + newMappings.length > 20) {
      return message.reply('A reaction-role panel must contain between 1 and 20 emoji-role pairs.');
    }

    const existingEmbed = EmbedBuilder.from(panelMessage.embeds[0]);
    const addedLines = newMappings.map(item => `${item.emoji} — **${item.roleName}**`).join('\n');
    const updatedDescription = `${panelMessage.embeds[0].description ?? ''}\n${addedLines}`.trim();
    if (updatedDescription.length > 4096) {
      return message.reply('Those additions would make the reaction-role message too long.');
    }

    try {
      for (const mapping of newMappings) await panelMessage.react(mapping.emoji);
      existingEmbed.setDescription(updatedDescription);
      await panelMessage.edit({ embeds: [existingEmbed] });
    } catch (error) {
      console.error('Could not edit reaction-role panel:', error);
      return message.reply('I could not add one of those emojis or edit the panel. Check my permissions and emoji access.');
    }

    for (const mapping of newMappings) panel.roles[mapping.emojiKey] = mapping.roleId;
    await saveReactionRolePanels();
    await message.reply(`Added **${newMappings.length}** new reaction role${newMappings.length === 1 ? '' : 's'} to the panel in ${panelChannel}.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Reaction-role editing cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!reactionroleadd` to start again.');
    } else {
      console.error('Reaction-role editing error:', error);
      await message.reply('Something went wrong while editing the reaction-role panel.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runReactionRoleEditWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Reaction-role message editing started! Type `cancel` at any step to stop.');

    const messageInput = await askWizardQuestion(
      message,
      '**1/3 — Message ID:** Enter the message ID of the reaction-role panel you want to edit.'
    );
    const panelMessageId = messageInput.match(/\d{17,20}/)?.[0];
    const panel = panelMessageId ? reactionRolePanels[panelMessageId] : null;
    if (!panel || panel.guildId !== message.guild.id || panel.type === 'verification') {
      return message.reply('I could not find a saved reaction-role panel with that message ID in this server.');
    }

    const panelChannel = message.guild.channels.cache.get(panel.channelId)
      ?? await message.guild.channels.fetch(panel.channelId);
    if (!panelChannel?.isTextBased()) return message.reply('The channel containing that panel no longer exists.');

    const panelMessage = await panelChannel.messages.fetch(panelMessageId).catch(() => null);
    if (!panelMessage || !panelMessage.embeds.length) {
      return message.reply('The reaction-role message no longer exists or no longer has an embed.');
    }

    const titleInput = await askWizardQuestion(
      message,
      '**2/3 — Title:** Enter the new title, or type `skip` to keep the current title.'
    );
    const descriptionInput = await askWizardQuestion(
      message,
      '**3/3 — Description:** Enter the new description, or type `skip` to keep the current description.'
    );

    if (titleInput.toLowerCase() !== 'skip' && titleInput.length > 256) {
      return message.reply('The title cannot be longer than 256 characters.');
    }

    const existingEmbedData = panelMessage.embeds[0];
    const updatedEmbed = EmbedBuilder.from(existingEmbedData);
    if (titleInput.toLowerCase() !== 'skip') updatedEmbed.setTitle(titleInput);

    if (descriptionInput.toLowerCase() !== 'skip') {
      const roleLines = Object.entries(panel.roles).map(([emojiKey, roleId]) => {
        const customEmoji = message.guild.emojis.cache.get(emojiKey);
        const emoji = customEmoji?.toString() ?? emojiKey;
        const role = message.guild.roles.cache.get(roleId);
        return `${emoji} — **${role?.name ?? 'Deleted role'}**`;
      });
      const updatedDescription = `${descriptionInput}\n\n${roleLines.join('\n')}`;
      if (updatedDescription.length > 4096) {
        return message.reply('That description is too long after including the reaction-role list.');
      }
      updatedEmbed.setDescription(updatedDescription);
    }

    await panelMessage.edit({ embeds: [updatedEmbed] });
    await message.reply(`The reaction-role panel in ${panelChannel} has been updated.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Reaction-role message editing cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!reactionroleedit` to start again.');
    } else {
      console.error('Reaction-role message editing error:', error);
      await message.reply('Something went wrong while editing the reaction-role message.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runVerificationWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Verification setup started! Type `cancel` at any step to stop.');

    const roleInput = await askWizardQuestion(
      message,
      '**1/2 — Verified role:** Mention the role members should receive, or enter its exact name.'
    );
    const role = findRole(message.guild, roleInput);
    if (!role) return message.reply('I could not find that role. Please run the wizard again.');

    const botMember = message.guild.members.me;
    if (role.id === message.guild.id || role.managed || role.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('That role cannot be used as the verification role.');
    }
    if (role.position >= botMember.roles.highest.position) {
      return message.reply(`Move my bot role above **${role.name}**, then run the wizard again.`);
    }

    const channelInput = await askWizardQuestion(
      message,
      '**2/2 — Verification channel:** Mention the channel where members should verify, such as `#verify`.'
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send messages in. Please run the wizard again.');
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Server Verification')
      .setDescription(`Welcome to **${message.guild.name}**!\n\nReact with ✅ below to verify yourself and access the server.`)
      .setColor(0x57f287)
      .setFooter({ text: 'Click the check mark to verify' });

    const verificationMessage = await targetChannel.send({ embeds: [embed] });
    try {
      await verificationMessage.react('✅');

      // Gate every currently public channel behind the verified role. Channels
      // that were already private (such as staff channels) are left unchanged.
      const channels = await message.guild.channels.fetch();
      const publicChannels = channels.filter(channel =>
        channel &&
        channel.id !== targetChannel.id &&
        channel.permissionOverwrites &&
        channel.permissionsFor(message.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)
      );

      for (const channel of publicChannels.values()) {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
        await channel.permissionOverwrites.edit(role, { ViewChannel: true });
      }

      // Unverified members can see the verification channel. Once the verified
      // role is added, its role overwrite hides this channel from them.
      await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
        ViewChannel: true,
        ReadMessageHistory: true,
      });
      await targetChannel.permissionOverwrites.edit(role, {
        ViewChannel: false,
        ReadMessageHistory: false,
      });
    } catch (error) {
      await verificationMessage.delete().catch(() => {});
      throw error;
    }

    reactionRolePanels[verificationMessage.id] = {
      guildId: message.guild.id,
      channelId: targetChannel.id,
      roles: { '✅': role.id },
      removeOnUnreact: false,
      type: 'verification',
    };
    await saveReactionRolePanels();
    await message.reply(`Verification is ready in ${targetChannel}. Members will receive **${role.name}**.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Verification setup cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!verifysetup` to start again.');
    } else {
      console.error('Verification setup error:', error);
      await message.reply('Something went wrong. Check my Manage Roles, Manage Channels, Add Reactions, and Embed Links permissions.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runWelcomeWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Welcome-message setup started! Type `cancel` at any step to stop.');

    const channelInput = await askWizardQuestion(
      message,
      '**1/2 — Welcome channel:** Mention the channel where welcome messages should be sent, such as `#welcome`.'
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send messages in. Please run the wizard again.');
    }

    const welcomeMessage = await askWizardQuestion(
      message,
      '**2/2 — Welcome message:** Enter the message sent after each member joins.\n\n' +
      'Available placeholders:\n' +
      '`{memberuser}` — mentions the member\n' +
      '`{membername}` — their display name\n' +
      '`{servername}` — this server’s name\n\n' +
      'Example: `Welcome {memberuser} to {servername}!`'
    );

    if (welcomeMessage.length > 1800) {
      return message.reply('That welcome message is too long. Please keep it under 1,800 characters.');
    }

    welcomeConfigs[message.guild.id] = {
      channelId: targetChannel.id,
      message: welcomeMessage,
    };
    await saveWelcomeConfigs();

    const preview = welcomeMessage
      .replaceAll('{memberuser}', `${message.author}`)
      .replaceAll('{membername}', message.member.displayName)
      .replaceAll('{servername}', message.guild.name);

    await message.reply(`Welcome messages will be sent in ${targetChannel}.\n\n**Preview:**\n${preview}`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Welcome-message setup cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!welcomesetup` to start again.');
    } else {
      console.error('Welcome-message setup error:', error);
      await message.reply('Something went wrong. Check my Send Messages permission and try again.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runNoCommandsWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('No-commands setup started! Type `cancel` to stop.');
    const channelInput = await askWizardQuestion(
      message,
      '**Channel selection:** Mention the channel where bot commands should be disabled, such as `#general`.\n' +
      'Choose an already-disabled channel to enable commands there again.'
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased()) {
      return message.reply('I could not find that text channel. Please run the wizard again.');
    }

    const disabledChannels = new Set(commandRestrictions[message.guild.id] ?? []);
    const commandsWereDisabled = disabledChannels.has(targetChannel.id);
    let response;
    if (commandsWereDisabled) {
      disabledChannels.delete(targetChannel.id);
      response = `Commands are now enabled again in ${targetChannel}.`;
    } else {
      disabledChannels.add(targetChannel.id);
      response = `Commands are now disabled in ${targetChannel}.`;
    }

    commandRestrictions[message.guild.id] = [...disabledChannels];
    await saveCommandRestrictions();
    await message.reply(response);
    await sendModerationLog(message.guild, {
      action: commandsWereDisabled ? 'Commands enabled' : 'Commands disabled',
      target: targetChannel,
      moderator: message.member,
      reason: `Command availability for ${targetChannel} was changed with !nocommandssetup.`,
    });
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('No-commands setup cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!nocommandssetup` to start again.');
    } else {
      console.error('No-commands setup error:', error);
      await message.reply('Something went wrong while saving the channel setting.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runTicketSetupWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }

  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Ticket setup started! Type `cancel` to stop.');
    const channelInput = await askWizardQuestion(
      message,
      '**Ticket panel channel:** Mention the channel where members should see the Open Ticket button, such as `#support`.'
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send messages in.');
    }

    const existing = ticketConfigs[message.guild.id];
    if (existing) {
      const oldChannel = message.guild.channels.cache.get(existing.channelId);
      const oldMessage = oldChannel?.isTextBased()
        ? await oldChannel.messages.fetch(existing.messageId).catch(() => null)
        : null;
      await oldMessage?.delete().catch(() => {});
    }

    const panelEmbed = new EmbedBuilder()
      .setTitle('Support Tickets')
      .setDescription('Need help? Click the button below to open a private ticket with the staff team.\n\nYou may have only **one open ticket** at a time.')
      .setColor(0x5865f2)
      .setFooter({ text: message.guild.name });
    const panelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel('Open Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );
    const panelMessage = await targetChannel.send({ embeds: [panelEmbed], components: [panelRow] });

    ticketConfigs[message.guild.id] = { channelId: targetChannel.id, messageId: panelMessage.id };
    await saveTicketConfigs();
    await message.reply(`The ticket panel is ready in ${targetChannel}. This is now the server's only ticket panel.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') {
      await message.reply('Ticket setup cancelled.');
    } else if (error.message === 'WIZARD_TIMEOUT') {
      await message.reply('The wizard timed out. Run `!ticketsetup` to start again.');
    } else {
      console.error('Ticket setup error:', error);
      await message.reply('Something went wrong. Check my Manage Channels, Send Messages, Embed Links, and View Channel permissions.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runLogsSetupWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }
  activeReactionRoleWizards.add(wizardKey);
  try {
    await message.reply('Moderation-log setup started! Type `cancel` to stop.');
    const channelInput = await askWizardQuestion(
      message,
      '**Log channel:** Mention the channel where moderation logs should be posted, such as `#mod-logs`.'
    );
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send messages in.');
    }
    logConfigs[message.guild.id] = { channelId: targetChannel.id };
    await saveLogConfigs();
    await message.reply(`Moderation logs will now be posted in ${targetChannel}.`);
    await sendModerationLog(message.guild, {
      action: 'Logs configured', target: message.member, moderator: message.member,
      reason: `This channel is now ${botName}’s moderation log.`,
    });
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') await message.reply('Moderation-log setup cancelled.');
    else if (error.message === 'WIZARD_TIMEOUT') await message.reply('The wizard timed out. Run `!setlogs` to start again.');
    else {
      console.error('Moderation-log setup error:', error);
      await message.reply('Something went wrong. Check my View Channel, Send Messages, and Embed Links permissions.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function runBumpSetupWizard(message) {
  const wizardKey = `${message.guild.id}:${message.author.id}`;
  if (activeReactionRoleWizards.has(wizardKey)) {
    return message.reply('You already have a setup wizard running in this server.');
  }
  activeReactionRoleWizards.add(wizardKey);
  try {
    const channelInput = await askWizardQuestion(
      message,
      '**Bump reminder channel:** Mention the channel where DISBOARD bumps happen, such as `#bump`. Type `OFF` to disable reminders.'
    );
    if (channelInput === 'OFF') {
      delete bumpConfigs[message.guild.id];
      const timer = bumpReminderTimers.get(message.guild.id);
      if (timer) clearTimeout(timer);
      bumpReminderTimers.delete(message.guild.id);
      await saveBumpConfigs();
      await message.reply('DISBOARD bump reminders are now disabled for this server.');
      return;
    }
    const targetChannel = findChannel(message.guild, channelInput);
    if (!targetChannel?.isTextBased() || !targetChannel.isSendable()) {
      return message.reply('I could not find a text channel I can send reminders in.');
    }
    bumpConfigs[message.guild.id] = { channelId: targetChannel.id, hours: 2, nextReminderAt: null };
    await saveBumpConfigs();
    await message.reply(`Bump reminders are enabled in ${targetChannel}. ${botName} will automatically detect each successful DISBOARD bump and remind the server when the fixed **2-hour cooldown** expires.`);
  } catch (error) {
    if (error.message === 'WIZARD_CANCELLED') await message.reply('Bump-reminder setup cancelled.');
    else if (error.message === 'WIZARD_TIMEOUT') await message.reply('The wizard timed out. Run `!setbump` to start again.');
    else {
      console.error('Bump setup error:', error);
      await message.reply('Something went wrong while saving the bump reminder.');
    }
  } finally {
    activeReactionRoleWizards.delete(wizardKey);
  }
}

async function clearAllChannelMessages(message) {
  if (channelsBeingCleared.has(message.channel.id)) {
    return message.reply('This channel is already being cleared.');
  }

  const confirmationPrompt = await message.reply(
    '⚠️ This will permanently delete every message in this channel. Type `CLEAR` within 20 seconds to confirm.'
  );
  const confirmations = await message.channel.awaitMessages({
    filter: reply => reply.author.id === message.author.id && reply.content === 'CLEAR',
    max: 1,
    time: 20_000,
  });

  if (!confirmations.size) {
    await confirmationPrompt.edit('Channel clear cancelled because it was not confirmed in time.');
    return;
  }

  channelsBeingCleared.add(message.channel.id);
  let deletedCount = 0;
  try {
    while (true) {
      const messages = await message.channel.messages.fetch({ limit: 100 });
      if (!messages.size) break;

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = messages.filter(item => item.createdTimestamp > twoWeeksAgo);
      const oldMessages = messages.filter(item => item.createdTimestamp <= twoWeeksAgo);

      if (recentMessages.size > 1) {
        const deleted = await message.channel.bulkDelete(recentMessages, true);
        deletedCount += deleted.size;
      } else if (recentMessages.size === 1) {
        await recentMessages.first().delete();
        deletedCount += 1;
      }

      for (const oldMessage of oldMessages.values()) {
        await oldMessage.delete();
        deletedCount += 1;
      }
    }

    console.log(`Cleared ${deletedCount} messages from #${message.channel.name} in ${message.guild.name}.`);
  } catch (error) {
    console.error('Channel clear error:', error);
    await message.channel.send('I could not finish clearing this channel. Check my Manage Messages and Read Message History permissions.');
  } finally {
    channelsBeingCleared.delete(message.channel.id);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
  for (const guildId of Object.keys(bumpConfigs)) scheduleBumpReminder(guildId);
});

client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

client.on('messageCreate', async (message) => {
  if (message.author.id === DISBOARD_BOT_ID && message.guild) {
    await recordSuccessfulBump(message).catch(error => console.error('Could not process DISBOARD bump:', error));
    return;
  }
  if (message.author.bot || !message.guild) return;

  const [command, ...args] = message.content.trim().split(/\s+/);

  // Block commands only in channels selected through !nocommandssetup.
  const disabledCommandChannels = commandRestrictions[message.guild.id] ?? [];
  if (command.startsWith('!') && disabledCommandChannels.includes(message.channel.id)) {
    await message.reply("You can't run commands in this channel.");
    return;
  }

  // Public fun reply commands
  const funReply = funReplies.get(command.toLowerCase());
  if (funReply) {
    await message.reply(funReply);
    return;
  }

  // !game - Starts a new game
if (command === '!game') {
  const number = Math.floor(Math.random() * 100) + 1;
  gameSessions.set(message.author.id, number);
  message.reply('I\'ve picked a number between 1 and 100. Try to guess it with !guess <number>!');
  return;
}

// !guess - Make a guess
else if (command === '!guess') {
  const guess = parseInt(args[0], 10);
  const target = gameSessions.get(message.author.id);

  if (!target) {
    message.reply('Start a game first by typing !game');
    return;
  }

  if (isNaN(guess) || guess < 1 || guess > 100) {
    message.reply('Please enter a valid number between 1 and 100.');
    return;
  }

  if (guess < target) {
    message.reply('Higher! 🔼');
  } else if (guess > target) {
    message.reply('Lower! 🔽');
  } else {
    message.reply('🎉 Correct! You guessed the number!');
    gameSessions.delete(message.author.id);
  }

  return;
}



  // !time command
  else if (command === '!time') {
    const roTime = DateTime.now().setZone('Europe/Bucharest').toFormat('dd LLL yyyy, HH:mm:ss');
    const beTime = DateTime.now().setZone('Europe/Brussels').toFormat('dd LLL yyyy, HH:mm:ss');
    message.reply(`🇷🇴 Bucharest time: ${roTime}\n🇧🇪 Brussels time: ${beTime}`);
    return;
  }

  // !joke command
  else if (command === '!joke') {
    try {
      const response = await fetch('https://v2.jokeapi.dev/joke/Any?type=single');
      const data = await response.json();
      message.reply(data.joke || 'Could not fetch a joke.');
    } catch {
      message.reply('Failed to fetch a joke.');
    }
    return;
  }

  // !dice command
  else if (command === '!dice') {
    const roll = Math.floor(Math.random() * 6) + 1;
    message.reply(`🎲 You rolled a ${roll}!`);
    return;
  }

  // !reactionrolesetup command
  else if (command === '!reactionrolesetup') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can create reaction-role panels.');
    }
    await runReactionRoleWizard(message);
    return;
  }

  // !reactionroleadd command
  else if (command === '!reactionroleadd') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can edit reaction-role panels.');
    }
    await runReactionRoleAddWizard(message);
    return;
  }

  // !reactionroleedit command
  else if (command === '!reactionroleedit') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can edit reaction-role panels.');
    }
    await runReactionRoleEditWizard(message);
    return;
  }

  // !verifysetup command
  else if (command === '!verifysetup') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can set up verification.');
    }
    await runVerificationWizard(message);
    return;
  }

  // !welcomesetup command
  else if (command === '!welcomesetup') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can set up welcome messages.');
    }
    await runWelcomeWizard(message);
    return;
  }

  // !nocommandssetup command
  else if (command === '!nocommandssetup') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can configure command-disabled channels.');
    }
    await runNoCommandsWizard(message);
    return;
  }

  // !ticketsetup command
  else if (command === '!ticketsetup') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can set up tickets.');
    }
    await runTicketSetupWizard(message);
    return;
  }

  // !setlogs command
  else if (command === '!setlogs') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can configure moderation logs.');
    }
    await runLogsSetupWizard(message);
    return;
  }

  // !setbump command
  else if (command === '!setbump') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can configure bump reminders.');
    }
    await runBumpSetupWizard(message);
    return;
  }

  // !hidechannel command - toggles channel visibility for regular members
  else if (command === '!hidechannel') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can hide channels.');
    }

    const guildHiddenChannels = new Set(hiddenChannels[message.guild.id] ?? []);
    const isHidden = guildHiddenChannels.has(message.channel.id);
    const verificationRoleIds = getVerificationRoleIds(message.guild.id);

    if (isHidden) {
      // Restore the verification gate if one exists. Otherwise, return the
      // @everyone overwrite to inherited/default visibility.
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        ViewChannel: verificationRoleIds.length ? false : null,
      });
      for (const roleId of verificationRoleIds) {
        const role = message.guild.roles.cache.get(roleId);
        if (role) await message.channel.permissionOverwrites.edit(role, { ViewChannel: true });
      }
      guildHiddenChannels.delete(message.channel.id);
      await message.reply('This channel is now visible to regular verified members again.');
    } else {
      // Keep the bot able to manage and later unhide the channel even when it
      // does not have the Administrator permission.
      await message.channel.permissionOverwrites.edit(message.guild.members.me, { ViewChannel: true });
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
      for (const roleId of verificationRoleIds) {
        const role = message.guild.roles.cache.get(roleId);
        if (role) await message.channel.permissionOverwrites.edit(role, { ViewChannel: false });
      }
      guildHiddenChannels.add(message.channel.id);
      await message.reply('This channel is now hidden from regular members.');
    }

    hiddenChannels[message.guild.id] = [...guildHiddenChannels];
    await saveHiddenChannels();
    await sendModerationLog(message.guild, {
      action: isHidden ? 'Channel shown' : 'Channel hidden',
      target: message.channel,
      moderator: message.member,
      reason: `Visibility for ${message.channel} was changed with !hidechannel.`,
    });
    return;
  }

  // !lockchannel command - toggles writing permissions for regular members
  else if (command === '!lockchannel') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can lock channels.');
    }

    const everyoneOverwrite = message.channel.permissionOverwrites.cache.get(message.guild.id);
    const isLocked = everyoneOverwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: isLocked ? null : false,
      SendMessagesInThreads: isLocked ? null : false,
      CreatePublicThreads: isLocked ? null : false,
      CreatePrivateThreads: isLocked ? null : false,
    });

    if (isLocked) {
      await message.reply('This channel is now unlocked for regular members.');
    } else {
      await message.channel.send('🔒 This channel is now locked. Only administrators can write here.');
    }
    await sendModerationLog(message.guild, {
      action: isLocked ? 'Channel unlocked' : 'Channel locked',
      target: message.channel,
      moderator: message.member,
      reason: `Writing permissions for ${message.channel} were changed with !lockchannel.`,
    });
    return;
  }

  // !warn command
  else if (command === '!warn') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can warn members.');
    }

    const warningInput = args.join(' ');
    const separatorIndex = warningInput.indexOf('|');
    const targetInput = (separatorIndex === -1 ? warningInput : warningInput.slice(0, separatorIndex)).trim();
    const warningMessage = separatorIndex === -1 ? '' : warningInput.slice(separatorIndex + 1).trim();

    const target = await findUser(message, targetInput);
    if (!target) return message.reply('User not found. Use their mention, nickname, username, or user ID.');
    if (target.user.bot) return message.reply('Bots cannot receive warnings.');

    warnings[message.guild.id] ??= {};
    warnings[message.guild.id][target.id] = (warnings[message.guild.id][target.id] ?? 0) + 1;
    await saveWarnings();

    const count = warnings[message.guild.id][target.id];
    let dmDelivered = true;
    try {
      await target.send(
        `⚠️ You have been warned in **${message.guild.name}**. ` +
        `You now have **${count} warning${count === 1 ? '' : 's'}**.` +
        (warningMessage ? `\n\n**Message from the moderator:** ${warningMessage}` : '')
      );
    } catch {
      dmDelivered = false;
    }

    await message.reply(
      `⚠️ ${target.displayName} has been warned. They now have **${count} warning${count === 1 ? '' : 's'}**.` +
      (warningMessage ? ` Message: **${warningMessage}**.` : '') +
      (dmDelivered ? '' : ' I could not DM them because their DMs are disabled.')
    );
    await sendModerationLog(message.guild, {
      action: 'Warned', target, moderator: message.member, reason: warningMessage,
    });
    return;
  }

  // !resetwarns command
  else if (command === '!resetwarns') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can reset warnings.');
    }

    const target = await findUser(message, args.join(' '));
    if (!target) return message.reply('User not found. Use their mention, nickname, username, or user ID.');

    warnings[message.guild.id] ??= {};
    warnings[message.guild.id][target.id] = 0;
    await saveWarnings();

    let dmDelivered = true;
    try {
      await target.send(
        `✅ Your warnings in **${message.guild.name}** were revoked. You now have **0 warnings**.`
      );
    } catch {
      dmDelivered = false;
    }

    await message.reply(
      `✅ ${target.displayName}'s warnings have been reset to **0**.` +
      (dmDelivered ? '' : ' I could not DM them because their DMs are disabled.')
    );
    await sendModerationLog(message.guild, {
      action: 'Warnings reset', target, moderator: message.member,
    });
    return;
  }

  // !warns command
  else if (command === '!warns') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can view member warnings.');
    }

    const target = await findUser(message, args.join(' '));
    if (!target) return message.reply('User not found. Use their mention, nickname, username, or user ID.');

    const count = warnings[message.guild.id]?.[target.id] ?? 0;
    await message.reply(
      `⚠️ ${target.displayName} has **${count} warning${count === 1 ? '' : 's'}** in this server.`
    );
    return;
  }

  // !clear command
  else if (command === '!clear') {
    if (!canUseModerationCommands(message)) {
      return message.reply('Only the server owner or an administrator can clear channels.');
    }
    await clearAllChannelMessages(message);
    return;
  }

  // !help command
  else if (command === '!help') {
    const commandFields = [
      { name: '!help', value: 'Shows the commands available to you' },
      { name: '!time', value: 'Shows the current time in Romania 🇷🇴 and Belgium 🇧🇪' },
      { name: '!joke', value: 'Tells a random joke from the internet' },
      { name: '!dice', value: 'Rolls a six-sided dice 🎲' },
      { name: '!game', value: 'Begins a guessing game' },
      { name: '!guess <number>', value: 'Makes a guess in your active guessing game' },
    ];

    if (botInstance !== 'avril') {
      commandFields.push({
        name: 'Fun commands',
        value: `\`!pat\` — Gives ${botName} a pat\n\`!poke\` — Pokes ${botName}\n\`!tickle\` — Tickles ${botName}\n\`!lick\` — Licks ${botName}\n\`!nibble\` — Nibbles ${botName}`,
      });
    }

    if (canUseModerationCommands(message)) {
      commandFields.push(
        { name: '!mute username [| reason]', value: 'Mutes a user, DMs them, and optionally includes a reason' },
        { name: '!unmute username [| reason]', value: 'Unmutes a user and DMs them, with an optional message' },
        { name: '!kick username', value: 'Kicks a user' },
        { name: '!ban username', value: 'Bans a user' },
        { name: '!unban username', value: 'Unbans a user' },
        { name: '!reactionrolesetup', value: 'Creates a reaction-role panel' },
        { name: '!reactionroleadd', value: 'Adds more emoji-role pairs to an existing panel' },
        { name: '!reactionroleedit', value: 'Edits an existing panel’s title or description' },
        { name: '!verifysetup', value: 'Creates a verification panel and assigns a verified role' },
        { name: '!welcomesetup', value: 'Configures the message sent when a member joins' },
        { name: '!nocommandssetup', value: 'Disables or enables bot commands in a selected channel' },
        { name: '!ticketsetup', value: 'Creates the server ticket panel (one open ticket per member)' },
        { name: '!setlogs', value: 'Selects the channel where timestamped moderation logs are posted' },
        { name: '!setbump', value: 'Selects the channel for automatic DISBOARD bump reminders' },
        { name: '!hidechannel', value: 'Hides or unhides the current channel for regular members' },
        { name: '!lockchannel', value: 'Locks or unlocks the current channel for regular members' },
        { name: '!warn username [| message]', value: 'Warns a member, with an optional message after `|`' },
        { name: '!warns username', value: 'Shows a member’s current warning total' },
        { name: '!resetwarns username', value: 'Resets a member’s warnings to zero' },
        { name: '!clear', value: 'Permanently deletes every message in the current channel' },
      );
    }

    // Discord permits at most 25 fields in one embed. Split automatically so
    // adding future commands cannot break the help command again.
    const fieldGroups = [];
    for (let index = 0; index < commandFields.length; index += 25) {
      fieldGroups.push(commandFields.slice(index, index + 25));
    }
    const embeds = fieldGroups.map((fields, index) => new EmbedBuilder()
      .setTitle(index === 0 ? 'Bot Commands' : 'Bot Commands — continued')
      .setColor(0x84fc03)
      .addFields(fields));
    embeds.at(-1).setFooter({ text: 'Made with ❤️ by Mihnea' });
    await message.channel.send({ embeds });
    return;
  }

 // !mute command (indefinite mute by adding "Muted" role)
else if (command === '!mute') {
  if (!canUseModerationCommands(message))
    return message.reply('Only the server owner or an administrator can mute users.');

  const muteInput = args.join(' ');
  const muteSeparator = muteInput.indexOf('|');
  const targetInput = (muteSeparator === -1 ? muteInput : muteInput.slice(0, muteSeparator)).trim();
  const muteReason = muteSeparator === -1 ? '' : muteInput.slice(muteSeparator + 1).trim();
  const target = await findUser(message, targetInput);
  if (!target) return message.reply('User not found.');

  const mutedRole = await getOrCreateMutedRole(message.guild);

  if (target.roles.cache.has(mutedRole.id)) {
    return message.reply(`${target.user.username} is already muted.`);
  }

  await target.roles.add(mutedRole, muteReason || `Muted by ${message.author.tag}`);
  const mutedAt = Date.now();
  moderationState[message.guild.id] ??= {};
  moderationState[message.guild.id][target.id] = {
    mutedAt,
    mutedBy: message.author.id,
    reason: muteReason,
  };
  await saveModerationState();
  let dmDelivered = true;
  try {
    await target.send(
      `🔇 You have been muted in **${message.guild.name}**.` +
      (muteReason ? `\n\n**Reason:** ${muteReason}` : '')
    );
  } catch {
    dmDelivered = false;
  }
  message.reply(
    `${target.user.username} has been muted indefinitely.` +
    (muteReason ? ` Reason: **${muteReason}**.` : '') +
    (dmDelivered ? '' : ' I could not DM them because their DMs are disabled.')
  );
  await sendModerationLog(message.guild, {
    action: 'Muted', target, moderator: message.member, reason: muteReason, occurredAt: mutedAt,
  });
  return;
}

// !unmute command (remove "Muted" role)
else if (command === '!unmute') {
  if (!canUseModerationCommands(message))
    return message.reply('Only the server owner or an administrator can unmute users.');

  const unmuteInput = args.join(' ');
  const unmuteSeparator = unmuteInput.indexOf('|');
  const targetInput = (unmuteSeparator === -1 ? unmuteInput : unmuteInput.slice(0, unmuteSeparator)).trim();
  const unmuteReason = unmuteSeparator === -1 ? '' : unmuteInput.slice(unmuteSeparator + 1).trim();
  const target = await findUser(message, targetInput);
  if (!target) return message.reply('User not found.');

  const mutedRole = await getOrCreateMutedRole(message.guild);

  if (!target.roles.cache.has(mutedRole.id)) {
    return message.reply(`${target.user.username} is not muted.`);
  }

  await target.roles.remove(mutedRole, unmuteReason || `Unmuted by ${message.author.tag}`);
  const muteRecord = moderationState[message.guild.id]?.[target.id];
  const muteDuration = muteRecord?.mutedAt ? formatDuration(Date.now() - muteRecord.mutedAt) : 'Unknown';
  if (moderationState[message.guild.id]) delete moderationState[message.guild.id][target.id];
  await saveModerationState();
  let dmDelivered = true;
  try {
    await target.send(
      `🔊 You have been unmuted in **${message.guild.name}**.` +
      (unmuteReason ? `\n\n**Message:** ${unmuteReason}` : '')
    );
  } catch {
    dmDelivered = false;
  }
  message.reply(
    `${target.user.username} has been unmuted.` +
    (unmuteReason ? ` Message: **${unmuteReason}**.` : '') +
    (dmDelivered ? '' : ' I could not DM them because their DMs are disabled.')
  );
  await sendModerationLog(message.guild, {
    action: 'Unmuted', target, moderator: message.member, reason: unmuteReason, duration: muteDuration,
  });
  return;
}


  // !kick command
  else if (command === '!kick') {
    if (!canUseModerationCommands(message)) return message.reply('Only the server owner or an administrator can kick users.');
    const target = await findUser(message, args.join(' '));
    if (!target) return message.reply('User not found.');
    await target.kick();
    message.reply(`${target.user.username} has been kicked.`);
    await sendModerationLog(message.guild, {
      action: 'Kicked', target, moderator: message.member,
    });
    return;
  }

  // !ban command
  else if (command === '!ban') {
    if (!canUseModerationCommands(message)) return message.reply('Only the server owner or an administrator can ban users.');
    const target = await findUser(message, args.join(' '));
    if (!target) return message.reply('User not found.');
    try {
      await target.send(`You have been banned from ${message.guild.name}.`);
    } catch {
      console.log("Couldn't send DM.");
    }
    await target.ban();
    message.reply(`${target.user.username} has been banned.`);
    await sendModerationLog(message.guild, {
      action: 'Banned', target, moderator: message.member,
    });
    return;
  }

  // !unban command
  else if (command === '!unban') {
    if (!canUseModerationCommands(message)) return message.reply('Only the server owner or an administrator can unban users.');
    const bans = await message.guild.bans.fetch();
    const userInput = args.join(' ').trim();
    const search = userInput.toLowerCase();
    const bannedUser = bans.find(b =>
      b.user.id === userInput ||
      b.user.username.toLowerCase() === search ||
      b.user.globalName?.toLowerCase() === search
    );
    if (!bannedUser) return message.reply('User not found in ban list.');
    await message.guild.members.unban(bannedUser.user.id);
    message.reply(`${bannedUser.user.username} has been unbanned.`);
    return;
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton() || !interaction.guild) return;
  if (!['ticket_open', 'ticket_claim', 'ticket_close'].includes(interaction.customId)) return;

  try {
    if (interaction.customId === 'ticket_open') {
      const config = ticketConfigs[interaction.guild.id];
      if (!config || interaction.message.id !== config.messageId) {
        return interaction.reply({ content: 'This ticket panel is no longer active.', ephemeral: true });
      }

      const creationKey = `${interaction.guild.id}:${interaction.user.id}`;
      let existingTicket = Object.entries(tickets).find(([, ticket]) =>
        ticket.guildId === interaction.guild.id && ticket.ownerId === interaction.user.id
      );
      if (existingTicket && !interaction.guild.channels.cache.has(existingTicket[0])) {
        const staleChannel = await interaction.guild.channels.fetch(existingTicket[0]).catch(() => null);
        if (!staleChannel) {
          delete tickets[existingTicket[0]];
          await saveTickets();
          existingTicket = null;
        }
      }
      if (existingTicket || ticketsBeingCreated.has(creationKey)) {
        const existingChannel = existingTicket && interaction.guild.channels.cache.get(existingTicket[0]);
        return interaction.reply({
          content: existingChannel
            ? `You already have an open ticket: ${existingChannel}`
            : 'You already have a ticket being opened. Please wait a moment.',
          ephemeral: true,
        });
      }

      ticketsBeingCreated.add(creationKey);
      await interaction.deferReply({ ephemeral: true });
      try {
        const safeName = interaction.member.displayName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 70) || 'member';
        const panelChannel = interaction.guild.channels.cache.get(config.channelId);
        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${safeName}`,
          type: ChannelType.GuildText,
          parent: panelChannel?.parentId ?? undefined,
          topic: `Support ticket opened by ${interaction.user.tag} (${interaction.user.id})`,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
            {
              id: interaction.client.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
            },
          ],
          reason: `Ticket opened by ${interaction.user.tag}`,
        });

        tickets[ticketChannel.id] = {
          guildId: interaction.guild.id,
          ownerId: interaction.user.id,
          claimedBy: null,
          createdAt: Date.now(),
          events: [],
        };
        await saveTickets();

        const ticketEmbed = new EmbedBuilder()
          .setTitle('New Support Ticket')
          .setDescription(`${interaction.user}, please describe what you need help with.\n\n**Status:** Waiting for an administrator to claim this ticket.`)
          .setColor(0xfee75c)
          .setTimestamp();
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );
        await ticketChannel.send({
          content: `${interaction.user} Administrators: a new ticket is waiting.`,
          embeds: [ticketEmbed],
          components: [controls],
          allowedMentions: { users: [interaction.user.id] },
        });
        await sendModerationLog(interaction.guild, {
          action: 'Ticket created',
          target: interaction.member,
          moderator: interaction.member,
          reason: `Opened ${ticketChannel}.`,
          occurredAt: tickets[ticketChannel.id].createdAt,
        });
        await interaction.editReply(`Your ticket has been opened: ${ticketChannel}`);
      } finally {
        ticketsBeingCreated.delete(creationKey);
      }
      return;
    }

    const ticket = tickets[interaction.channel.id];
    if (!ticket || ticket.guildId !== interaction.guild.id) {
      return interaction.reply({ content: 'This is not an active ticket channel.', ephemeral: true });
    }
    const isAdmin = interaction.member.id === interaction.guild.ownerId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (interaction.customId === 'ticket_claim') {
      if (!isAdmin) {
        return interaction.reply({ content: 'Only the server owner or an administrator can claim tickets.', ephemeral: true });
      }
      if (ticket.claimedBy) {
        return interaction.reply({ content: `This ticket has already been claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      }

      ticket.claimedBy = interaction.user.id;
      ticket.claimedAt = Date.now();
      ticket.events ??= [];
      ticket.events.push({
        type: 'claimed',
        at: ticket.claimedAt,
        byId: interaction.user.id,
        byName: interaction.member.displayName,
      });
      await saveTickets();
      const claimedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(`<@${ticket.ownerId}>, please describe what you need help with.\n\n**Status:** Claimed by ${interaction.user}.`)
        .setColor(0x57f287);
      const claimedControls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel(`Claimed by ${interaction.member.displayName}`.slice(0, 80)).setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );
      await interaction.update({ embeds: [claimedEmbed], components: [claimedControls] });
      await interaction.followUp({ content: `✅ ${interaction.user} has claimed this ticket.` });
      const ticketOwner = interaction.guild.members.cache.get(ticket.ownerId)
        ?? await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
      if (ticketOwner) {
        await sendModerationLog(interaction.guild, {
          action: 'Ticket assigned',
          target: ticketOwner,
          moderator: interaction.member,
          reason: `${interaction.channel} was assigned to ${interaction.member}.`,
        });
      }
      return;
    }

    if (!isAdmin && interaction.user.id !== ticket.ownerId) {
      return interaction.reply({ content: 'Only the ticket owner or an administrator can close this ticket.', ephemeral: true });
    }
    await interaction.deferReply();
    await createTicketTranscript(interaction.channel, ticket, interaction.member);
    await interaction.editReply('🔒 This ticket will close in 5 seconds.');
    const ticketOwner = interaction.guild.members.cache.get(ticket.ownerId)
      ?? await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
    if (ticketOwner) {
      await sendModerationLog(interaction.guild, {
        action: 'Ticket closed',
        target: ticketOwner,
        moderator: interaction.member,
        reason: `${interaction.channel} was closed from Discord.`,
        duration: ticket.createdAt ? formatDuration(Date.now() - ticket.createdAt) : '',
      });
    }
    delete tickets[interaction.channel.id];
    await saveTickets();
    setTimeout(() => {
      interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(error =>
        console.error('Could not delete ticket channel:', error)
      );
    }, 5_000);
  } catch (error) {
    console.error('Ticket interaction error:', error);
    const response = { content: 'Something went wrong with this ticket. Check my Manage Channels permissions.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.on(Events.ChannelDelete, channel => {
  if (!tickets[channel.id]) return;
  delete tickets[channel.id];
  void saveTickets().catch(error => console.error('Could not remove deleted ticket record:', error));
});

async function handleReactionRole(reaction, user, shouldAddRole) {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    const panel = reactionRolePanels[reaction.message.id];
    if (!panel) return;

    const roleId = panel.roles[reactionEmojiKey(reaction.emoji)];
    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild || guild.id !== panel.guildId) return;

    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId);
    if (!role) return;

    if (shouldAddRole) {
      if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Reaction role selected');
    } else if (panel.removeOnUnreact !== false && member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Reaction role removed');
    }
  } catch (error) {
    console.error('Could not update a reaction role:', error);
  }
}

client.on(Events.MessageReactionAdd, (reaction, user) => {
  void handleReactionRole(reaction, user, true);
});

client.on(Events.MessageReactionRemove, (reaction, user) => {
  void handleReactionRole(reaction, user, false);
});

client.on(Events.GuildMemberAdd, async member => {
  const config = welcomeConfigs[member.guild.id];
  if (!config) return;

  try {
    const channel = member.guild.channels.cache.get(config.channelId)
      ?? await member.guild.channels.fetch(config.channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) return;

    const welcomeMessage = config.message
      .replaceAll('{memberuser}', `<@${member.id}>`)
      .replaceAll('{membername}', member.displayName)
      .replaceAll('{servername}', member.guild.name);

    await channel.send({
      content: welcomeMessage,
      allowedMentions: { parse: [], users: [member.id] },
    });
  } catch (error) {
    console.error('Could not send a welcome message:', error);
  }
});

const tokenName = `${botInstance.toUpperCase().replaceAll('-', '_')}_TOKEN`;
let botToken = process.env[tokenName] ?? process.env.TOKEN;
if (!botToken) {
  if (!process.stdin.isTTY) {
    throw new Error(`No Discord token is configured. Start the bot interactively once or add ${tokenName}=... to .env.`);
  }

  console.log('\nFirst-time setup');
  console.log('Paste your Discord Custom Bot token below. It will only be stored in the local .env file, which Git ignores.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  botToken = (await prompt.question('Discord Custom Bot token: ')).trim();
  prompt.close();
  if (!botToken || /[\r\n]/.test(botToken)) throw new Error('No valid token was entered.');

  const envFile = join(appRoot, '.env');
  let currentEnv = '';
  try {
    currentEnv = await readFile(envFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const separator = currentEnv && !currentEnv.endsWith('\n') ? '\n' : '';
  await writeFile(envFile, `${currentEnv}${separator}${tokenName}=${botToken}\n`, 'utf8');
  console.log('Token saved locally. Starting the bot...\n');
}
client.login(botToken);
