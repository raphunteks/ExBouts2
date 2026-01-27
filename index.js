require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ChannelType,
  AttachmentBuilder,
  Events,
  MessageFlags,
} = require('discord.js');

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const BOT_START_TIME = Date.now();

const RAW_OWNER_IDS =
  process.env.OWNER_IDS ||
  process.env.OWNER_ID ||
  '';

const OWNER_IDS = RAW_OWNER_IDS.split(/[,\s]+/).filter(Boolean);

const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID ||
  process.env.CATTEGORY_TICKETCHANEL_ID ||
  process.env.CATTEGORY_TICKETCHANNEL_ID ||
  null;

const CHANNEL_LOGORDER_ID = process.env.CHANNEL_LOGORDER_ID || null;
const LOGPAID_CHANNEL_ID = process.env.LOGPAID_CHANNEL_ID || null;

let welcomeChannelId = process.env.WELCOME_CHANNEL_ID || null;
let leaveChannelId = process.env.LEAVE_CHANNEL_ID || null;

const PAID_ROLE_ID = process.env.PAID_ROLE_ID || null;
const ORDER_PAID_CHANNEL_ID = process.env.ORDER_PAID_CHANNEL_ID || null;

const PAIDKEY_VALIDATE_BASE =
  process.env.PAIDKEY_VALIDATE_BASE ||
  'https://exc-webs.vercel.app/api/paidkey/isValidate';

const PAIDKEY_CREATE_URL =
  process.env.PAIDKEY_CREATE_URL ||
  'https://exc-webs.vercel.app/api/paidkey/createOrUpdate';

const EXHUB_USERINFO_URL =
  process.env.EXHUB_USERINFO_URL ||
  'https://exc-webs.vercel.app/api/paidfree/user-info';

const RESET_HWID_API_URL =
  process.env.RESET_HWID_API_URL ||
  null;

const EXHUB_SCRIPT_URL = process.env.EXHUB_SCRIPT_URL || null;
const EXHUB_DASHBOARD_URL = process.env.EXHUB_DASHBOARD_URL || null;

const WELCOME_BG_URL = process.env.WELCOME_BG_URL || null;
const WELCOME_CARD_BG_URL =
  process.env.WELCOME_CARD_BG_URL || WELCOME_BG_URL || null;

const LEAVE_BG_URL = process.env.LEAVE_BG_URL || WELCOME_BG_URL || null;
const LEAVE_CARD_BG_URL =
  process.env.LEAVE_CARD_BG_URL ||
  LEAVE_BG_URL ||
  WELCOME_CARD_BG_URL ||
  null;

const QRIS_IMAGE_URL = process.env.QRIS_IMAGE_URL || null;

const EVERYONE_ROLE_ID =
  process.env.EVERYONE_ROLE_ID || '1462774806079340574';
const UPDATE_CHANNEL_ID = process.env.UPDATE_CHANNEL_ID || null;

const SERVER_STATS_CATEGORY_ID = process.env.SERVER_STATS_CATEGORY_ID || null;
const SERVER_STATS_ALL_ID = process.env.SERVER_STATS_ALL_ID || null;
const SERVER_STATS_MEMBERS_ID = process.env.SERVER_STATS_MEMBERS_ID || null;
const SERVER_STATS_BOTS_ID = process.env.SERVER_STATS_BOTS_ID || null;
const SERVER_STATS_BOOSTS_ID = process.env.SERVER_STATS_BOOSTS_ID || null;

const REACTION_ROLE_CONFIG_PATH =
  process.env.REACTION_ROLE_CONFIG_PATH ||
  path.join(__dirname, 'configrole.json');

let priceKeyMonth = Number(process.env.PRICE_KEY_MONTH || 15000);
let priceKey3Month = Number(process.env.PRICE_KEY_3MONTH || 40000);
let priceKey6Month = Number(process.env.PRICE_KEY_6MONTH || 70000);
let priceKeyLifetime = Number(process.env.PRICE_KEY_LIFETIME || 25000);
let priceIndoHangout = Number(process.env.PRICE_INDO_HANGOUT || 10000);

// flag runtime untuk hide/show paket di dropdown ticket
let disableLifetimeInDropdown = false;
let disable3MonthInDropdown = false;
let disable6MonthInDropdown = false;

const ticketOwners = new Map();
const ticketOrders = new Map(); // channelId -> { type, price, timestamp }
const reactionRoles = new Map();
let reactionRoleStore = loadReactionRoleConfig();

for (const [messageId, conf] of Object.entries(reactionRoleStore)) {
  if (!Array.isArray(conf) || !conf.length) continue;
  const normalized = conf
    .filter(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.emoji === 'string' &&
        typeof p.roleId === 'string'
    )
    .map((p) => ({
      emoji: String(p.emoji),
      roleId: String(p.roleId),
      roleName: p.roleName ? String(p.roleName) : undefined,
    }));

  if (normalized.length) {
    reactionRoles.set(messageId, normalized);
  }
}

console.log(
  `[ReactionRole] Loaded ${reactionRoles.size} reaction-role messages from configrole.json`
);

function loadReactionRoleConfig() {
  try {
    if (!fs.existsSync(REACTION_ROLE_CONFIG_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(REACTION_ROLE_CONFIG_PATH, 'utf8');
    if (!raw.trim()) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    return data;
  } catch (err) {
    console.error(
      '[ReactionRole] Gagal load configrole.json, menggunakan config kosong:',
      err
    );
    return {};
  }
}

function saveReactionRoleConfig(store) {
  try {
    const dir = path.dirname(REACTION_ROLE_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      REACTION_ROLE_CONFIG_PATH,
      JSON.stringify(store, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(
      '[ReactionRole] Gagal menyimpan configrole.json:',
      err
    );
  }
}

function isOwner(userId) {
  return OWNER_IDS.includes(String(userId));
}

function formatRupiah(num) {
  if (!num && num !== 0) return '-';
  return num.toLocaleString('id-ID');
}

function generatePaidKey() {
  const segment = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EXHUBPAID-${segment}`;
}

function formatSecondsToHMS(sec) {
  const s = sec % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function buildRuntimeMessage(client) {
  const uptimeSec = Math.floor(process.uptime());
  const startTimestampSec = Math.floor(BOT_START_TIME / 1000);
  const nowSec = Math.floor(Date.now() / 1000);

  const mem = process.memoryUsage();
  const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
  const toGB = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2);

  const guildCount = client.guilds.cache.size;

  const osType = os.type();
  const osRelease = os.release();
  const osPlatform = os.platform();
  const osArch = os.arch();

  const cpus = os.cpus() || [];
  const coreCount = cpus.length;
  const cpuModel = coreCount ? cpus[0].model : 'Unknown';
  const cpuSpeed = coreCount ? cpus[0].speed : 0;

  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();

  const cpuLines = coreCount
    ? `• CPU           : \`${cpuModel}\`\n` +
      `• CPU Cores     : \`${coreCount} cores @ ${cpuSpeed} MHz\`\n`
    : '• CPU           : `Unknown`\n';

  const msg =
    `⏱️ **Runtime Bot**\n` +
    `• Uptime        : \`${formatSecondsToHMS(
      uptimeSec
    )}\` (sejak <t:${nowSec - uptimeSec}:R>)\n` +
    `• Start Time    : <t:${startTimestampSec}:F>\n` +
    `• Guilds        : \`${guildCount}\`\n` +
    `• Node.js       : \`${process.version}\`\n` +
    `• Memory (RSS)  : \`${toMB(mem.rss)} MB\`\n` +
    `• Heap Used     : \`${toMB(mem.heapUsed)} MB\`` +
    `\n\n🖥️ **Spesifikasi Core VPS**\n` +
    `• OS            : \`${osType} ${osRelease} (${osPlatform}/${osArch})\`\n` +
    cpuLines +
    `• RAM (Total)   : \`${toGB(totalMemBytes)} GB\`\n` +
    `• RAM (Free)    : \`${toGB(freeMemBytes)} GB\``;

  return msg;
}

function splitList(text) {
  if (!text) return [];
  return String(text)
    .split(/[\n;,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDateTimeWIB(date = new Date()) {
  const dtf = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';

  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');

  return `Today ${day}-${month}-${year} ${hour}:${minute} WIB`;
}

function mapStatusLabelAndColor(rawStatus) {
  const s = String(rawStatus || '').trim();

  if (!s) {
    return {
      label: '[🟢] WORKING / STABLE',
      color: 0x57f287,
      headerEmoji: ':green_circle:',
    };
  }

  const upper = s.toUpperCase();

  if (
    upper.includes('WORKING') ||
    upper.includes('STABLE') ||
    upper === 'ONLINE'
  ) {
    return {
      label: '[🟢] WORKING / STABLE',
      color: 0x57f287,
      headerEmoji: ':green_circle:',
    };
  }

  if (upper.startsWith('OUTDATED')) {
    return {
      label: '[🟡] OUTDATED (BISA DIPAKE)',
      color: 0xfee75c,
      headerEmoji: ':yellow_circle:',
    };
  }

  if (upper.includes('NOT WORKING') || upper === 'OFFLINE') {
    return {
      label: '❌ NOT WORKING',
      color: 0xed4245,
      headerEmoji: ':red_circle:',
    };
  }

  if (upper.includes('NEED UPDATE')) {
    return {
      label: '🛠️ NEED UPDATE',
      color: 0xf39c12,
      headerEmoji: ':wrench:',
    };
  }

  if (upper.includes('COMING SOON')) {
    return {
      label: '⏳ COMING SOON',
      color: 0x2b2d31,
      headerEmoji: ':hourglass_flowing_sand:',
    };
  }

  return {
    label: s,
    color: 0x2b2d31,
    headerEmoji: ':white_small_square:',
  };
}

function buildScriptUpdatePayload(options, guild, clientInstance) {
  const scriptName = options.scriptName || options.script || 'UNKNOWN';
  const rawStatus = options.status || 'WORKING';

  const { label: statusLabel, color, headerEmoji } =
    mapStatusLabelAndColor(rawStatus);

  const featuresRaw = options.features || '';
  const changeLogsRaw = options.changeLogs || options.changelogs || '';
  const nextUpdateRaw = options.nextUpdate || '';

  const featuresList = splitList(featuresRaw);
  const changeLogsList = splitList(changeLogsRaw);
  let nextUpdateList = splitList(nextUpdateRaw);

  if (!nextUpdateList.length) {
    nextUpdateList = ['-'];
  }

  const formatLines = (list, defaultPrefix) => {
    if (!list || !list.length) return ['-'];
    const out = [];
    for (const raw of list) {
      const line = String(raw).trim();
      if (!line) continue;

      if (/^([\[\:\-\•\*]|<:)/.test(line)) {
        out.push(line);
      } else {
        out.push(`${defaultPrefix} ${line}`);
      }
    }
    return out.length ? out : ['-'];
  };

  const featureLines = formatLines(featuresList, '[✅]');
  const changelogLines = formatLines(changeLogsList, '[+]');
  const nextUpdateLines = formatLines(nextUpdateList, '[⏭️]');

  let mention = '@everyone';

  if (
    EVERYONE_ROLE_ID &&
    /^\d{5,}$/.test(EVERYONE_ROLE_ID) &&
    guild &&
    guild.roles
  ) {
    const role = guild.roles.cache.get(EVERYONE_ROLE_ID);
    if (role && !role.name.startsWith('@')) {
      mention = `<@&${EVERYONE_ROLE_ID}>`;
    }
  }

  const descriptionParts = [];

  const headerStatusEmoji = headerEmoji || ':green_circle:';
  descriptionParts.push(`**【${headerStatusEmoji} 】NEW UPDATED**`);

  descriptionParts.push('```');
  descriptionParts.push(`[SCRIPT]: ${scriptName}`);
  descriptionParts.push(`[STATUS]: ${statusLabel}`);
  descriptionParts.push('```');

  descriptionParts.push('');
  descriptionParts.push('**【:information_source:】 FEATURES**');
  descriptionParts.push('```');
  descriptionParts.push(...featureLines);
  descriptionParts.push('```');

  descriptionParts.push('');
  descriptionParts.push('**【:arrow_up_down: 】 CHANGE LOGS**');
  descriptionParts.push('```');
  descriptionParts.push(...changelogLines);
  descriptionParts.push('```');

  descriptionParts.push('');
  descriptionParts.push('**【:hourglass_flowing_sand:】NEXT UPDATE**');
  descriptionParts.push('```');
  descriptionParts.push(...nextUpdateLines);
  descriptionParts.push('```');

  const description = descriptionParts.join('\n');

  const guildName = guild ? guild.name : 'ExHub';
  const footerText = `${guildName} | ${formatDateTimeWIB()}`;

  const botAvatar =
    clientInstance &&
    clientInstance.user &&
    clientInstance.user.displayAvatarURL();
  const footerIcon = botAvatar || null;

  const embed = new EmbedBuilder().setDescription(description).setColor(color);

  if (footerIcon) {
    embed.setFooter({ text: footerText, iconURL: footerIcon });
  } else {
    embed.setFooter({ text: footerText });
  }

  return {
    content: mention,
    embeds: [embed],
  };
}

function normalizeKeyType(raw) {
  if (!raw) return '';
  const t = String(raw).trim().toLowerCase();

  if (['month', 'monthly', 'sebulan', '1bulan', '30d', '30days'].includes(t)) {
    return 'month';
  }

  if (
    ['lifetime', 'life', 'selamanya', 'permanent', 'permanentkey'].includes(t)
  ) {
    return 'lifetime';
  }

  return t;
}

function getTicketOwnerId(channel) {
  if (!channel) return null;

  if (ticketOwners.has(channel.id)) {
    return ticketOwners.get(channel.id);
  }

  const topic = channel.topic || '';
  const match = topic.match(/OwnerID:(\d{5,})/);
  return match ? match[1] : null;
}

function resolveKeyOwnerDiscordId(interaction, targetUser) {
  if (targetUser) {
    return String(targetUser.id);
  }

  const ch = interaction.channel;
  if (ch && ch.type === ChannelType.GuildText) {
    const ticketOwnerId = getTicketOwnerId(ch);
    if (ticketOwnerId) return String(ticketOwnerId);
  }

  return String(interaction.user.id);
}

async function validatePaidKey(key) {
  const base = PAIDKEY_VALIDATE_BASE.replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Validate key HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function createPaidKeyOnAPI(key, type, expiresDurationMs, override = {}) {
  if (!PAIDKEY_CREATE_URL) {
    console.warn(
      '[WARN] PAIDKEY_CREATE_URL belum diisi, key tidak dikirim ke API.'
    );
    return;
  }

  const now = Date.now();
  const createdAt = override.createdAt ?? now;

  const normalizedType = normalizeKeyType(type || '') || (type || null);

  let expiresAfter = override.expiresAfter;
  if (!expiresAfter) {
    if (expiresDurationMs && expiresDurationMs > 0) {
      expiresAfter = createdAt + expiresDurationMs;
    } else {
      expiresAfter = createdAt;
    }
  }

  const info = {
    token: key,
    createdAt,
    byIp: override.byIp || 'discord-bot',
    expiresAfter,
    type: normalizedType,
  };

  if (override.ownerDiscordId) {
    info.ownerDiscordId = String(override.ownerDiscordId);
  }

  const payload = {
    valid: override.valid ?? false,
    deleted: override.deleted ?? false,
    expired: false,
    info,
  };

  const res = await fetch(PAIDKEY_CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Create/Update key API error ${res.status}: ${text.slice(0, 200)}`
    );
  }
}

function toMs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

async function resetHwidOnAPI(key, discordUser) {
  if (!RESET_HWID_API_URL) {
    throw new Error('RESET_HWID_API_URL belum dikonfigurasi di .env');
  }

  const payload = {
    key,
    token: key,
    discordId: discordUser.id,
    discordTag: discordUser.username
      ? `${discordUser.username}#${discordUser.discriminator || '0000'}`
      : String(discordUser.id),
  };

  const res = await fetch(RESET_HWID_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => '');
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      (json && (json.error || json.message)) ||
      text.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json || { ok: true };
}

async function fetchUserKeyInfo(discordUser) {
  if (!EXHUB_USERINFO_URL) {
    throw new Error('EXHUB_USERINFO_URL belum dikonfigurasi.');
  }

  try {
    const res = await fetch(EXHUB_USERINFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discordId: discordUser.id,
        discordTag: discordUser.username,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(
        '[DEBUG user-info] Gagal parse JSON dari user-info:',
        e,
        text.slice(0, 200)
      );
      return { paidKeys: [], freeKeys: [], allKeys: [], raw: null, stats: {} };
    }

    if (!data || !Array.isArray(data.keys)) {
      console.log(
        '[DEBUG user-info] Tidak menemukan array key di response user-info. URL =',
        EXHUB_USERINFO_URL
      );
      return { paidKeys: [], freeKeys: [], allKeys: [], raw: data, stats: {} };
    }

    const now = Date.now();
    const rawKeys = data.keys;

    const byToken = new Map();
    for (const k of rawKeys) {
      if (!k || typeof k !== 'object') continue;

      let token =
        k.token ||
        k.key ||
        k.keyToken ||
        (k.info && (k.info.token || k.info.key)) ||
        null;

      if (!token) continue;
      token = String(token);

      if (!byToken.has(token)) {
        byToken.set(token, k);
      }
    }

    const uniqKeys = Array.from(byToken.values());

    const allKeys = [];
    const paidKeys = [];
    const freeKeys = [];

    for (const k of uniqKeys) {
      if (!k) continue;

      const providerRaw = String(k.provider || k.source || '').toLowerCase();
      const providerLabel = providerRaw || 'unknown';

      const tierRaw =
        k.tier ||
        k.type ||
        (k.info && (k.info.tier || k.info.type)) ||
        '';
      const typeNorm = normalizeKeyType(tierRaw);

      const isFree =
        typeNorm === 'free' ||
        providerRaw === 'work.ink' ||
        providerRaw === 'workink' ||
        providerRaw.includes('linkvertise') ||
        k.free === true;

      let token =
        k.token ||
        k.key ||
        k.keyToken ||
        (k.info && (k.info.token || k.info.key)) ||
        null;

      if (!token) continue;
      token = String(token);

      const ownerDiscordId =
        k.ownerDiscordId ||
        (k.info && (k.info.ownerDiscordId)) ||
        null;

      const createdAtMs =
        toMs(k.createdAt) ||
        (k.info ? toMs(k.info.createdAt) : null);

      const expiresAfterMs =
        toMs(k.expiresAfter) ||
        toMs(k.expiresAtMs) ||
        toMs(k.expiresAt) ||
        (k.info ? toMs(k.info.expiresAfter) : null);

      const deleted = !!(k.deleted || (k.info && k.info.deleted));
      const valid =
        typeof k.valid === 'boolean'
          ? k.valid
          : k.info && typeof k.info.valid === 'boolean'
          ? k.info.valid
          : true;

      const expired =
        expiresAfterMs && typeof expiresAfterMs === 'number'
          ? now > expiresAfterMs
          : !!k.expired;

      let status;
      if (deleted) status = 'Deleted';
      else if (expired) status = 'Expired';
      else if (!valid) status = 'Not Redeemed';
      else status = 'Active';

      const norm = {
        token,
        type: typeNorm || (isFree ? 'free' : 'paid'),
        provider: providerLabel,
        createdAtMs,
        expiresAfterMs,
        deleted,
        valid,
        expired,
        status,
        ownerDiscordId: ownerDiscordId ? String(ownerDiscordId) : null,
      };

      allKeys.push(norm);
      if (isFree) freeKeys.push(norm);
      else paidKeys.push(norm);
    }

    const stats = {};
    const s = data.stats || data.execStats || data.usage || {};

    const totalExecCandidates = [
      data.totalExec,
      data.totalExecutions,
      data.totalUses,
      s.totalExec,
      s.totalExecutions,
      s.totalUses,
      s.total,
    ];
    let totalExec = null;
    for (const v of totalExecCandidates) {
      const n = toNumber(v);
      if (n !== null) {
        totalExec = n;
        break;
      }
    }

    const lastExecMsCandidates = [
      data.lastExecAt,
      data.lastExecutionAt,
      data.lastUseAt,
      data.lastUsedAt,
      s.lastExecAt,
      s.lastExecutionAt,
      s.lastUseAt,
      s.lastUsedAt,
    ];
    let lastExecAtMs = null;
    for (const v of lastExecMsCandidates) {
      const ms = toMs(v);
      if (ms !== null) {
        lastExecAtMs = ms;
        break;
      }
    }

    const executorName =
      data.executor ||
      data.lastExecutor ||
      (s && (s.executor || s.lastExecutor)) ||
      null;

    const subscription =
      data.subscription ||
      (data.profile && data.profile.subscription) ||
      data.plan ||
      null;

    const totalClaimedCandidates = [
      data.totalClaimed,
      s.totalClaimed,
      s.claimed,
    ];
    let totalClaimed = null;
    for (const v of totalClaimedCandidates) {
      const n = toNumber(v);
      if (n !== null) {
        totalClaimed = n;
        break;
      }
    }

    const lastClaimMsCandidates = [
      data.lastClaimedAt,
      data.lastClaimAt,
      s.lastClaimedAt,
      s.lastClaimAt,
    ];
    let lastClaimAtMs = null;
    for (const v of lastClaimMsCandidates) {
      const ms = toMs(v);
      if (ms !== null) {
        lastClaimAtMs = ms;
        break;
      }
    }

    stats.totalExec = totalExec;
    stats.lastExecAtMs = lastExecAtMs;
    stats.executorName = executorName;
    stats.subscription = subscription;
    stats.totalClaimed = totalClaimed;
    stats.lastClaimAtMs = lastClaimAtMs;

    console.log(
      `[DEBUG user-info] Discord ${discordUser.id} – keys=${allKeys.length}, paid=${paidKeys.length}, free=${freeKeys.length}, totalExec=${
        stats.totalExec ?? 'NA'
      }`
    );

    return { paidKeys, freeKeys, allKeys, raw: data, stats };
  } catch (err) {
    console.log('[DEBUG user-info] Error call user-info:', err);
    return { paidKeys: [], freeKeys: [], allKeys: [], raw: null, stats: {} };
  }
}

async function fetchUserPaidKeys(discordUser) {
  const info = await fetchUserKeyInfo(discordUser);
  return info.paidKeys;
}

async function lookupRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Roblox API error ${res.status}`);
  }

  const json = await res.json();
  if (!json || !Array.isArray(json.data) || json.data.length === 0) {
    return null;
  }

  const u = json.data[0];
  return {
    id: u.id,
    name: u.name,
    displayName: u.displayName,
  };
}

function robloxAvatarUrl(userId) {
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
}

async function logOrder(guild, embed) {
  if (!CHANNEL_LOGORDER_ID) return;
  try {
    const ch = guild.channels.cache.get(CHANNEL_LOGORDER_ID);
    if (!ch) return;
    await ch.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to send log order:', err);
  }
}

async function logPaidOrder(guild, options) {
  if (!LOGPAID_CHANNEL_ID) return;
  try {
    const ch = guild.channels.cache.get(LOGPAID_CHANNEL_ID);
    if (!ch) return;
    await ch.send(options);
  } catch (err) {
    console.error('Failed to send paid order log:', err);
  }
}

async function generateWelcomeCard(member) {
  const width = 1262;
  const height = 576;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (WELCOME_CARD_BG_URL) {
    try {
      const bg = await loadImage(WELCOME_CARD_BG_URL);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch (err) {
      console.error('[welcome-card] Gagal load background:', err);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);
  }

  const avatarUrl = member.user.displayAvatarURL({
    extension: 'png',
    size: 512,
  });

  let avatar;
  try {
    avatar = await loadImage(avatarUrl);
  } catch (err) {
    console.error('[welcome-card] Gagal load avatar:', err);
    avatar = null;
  }

  const avatarRadius = 150;
  const avatarX = width / 2;
  const avatarY = height * 0.33;

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2, true);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2196f3';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#2196f3';
  ctx.font = 'bold 96px Sans-Serif';
  const welcomeTextY = avatarY + avatarRadius + 80;
  ctx.fillText('WELCOME', width / 2, welcomeTextY);

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;

  const baseUsername =
    member.user.globalName || member.user.username || 'NEW MEMBER';
  const username = baseUsername.toUpperCase();

  let fontSize = 54;
  ctx.font = `bold ${fontSize}px Sans-Serif`;
  let measured = ctx.measureText(username);
  const maxWidth = width - 220;

  while (measured.width > maxWidth && fontSize > 26) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Sans-Serif`;
    measured = ctx.measureText(username);
  }

  ctx.fillStyle = '#ffffff';
  const usernameY = welcomeTextY + 70;
  ctx.fillText(username, width / 2, usernameY);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const buffer = await canvas.encode('png');
  return buffer;
}

async function generateLeaveCard(member) {
  const width = 1262;
  const height = 576;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (LEAVE_CARD_BG_URL) {
    try {
      const bg = await loadImage(LEAVE_CARD_BG_URL);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch (err) {
      console.error('[leave-card] Gagal load background:', err);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);
  }

  const avatarUrl = member.user.displayAvatarURL({
    extension: 'png',
    size: 512,
  });

  let avatar;
  try {
    avatar = await loadImage(avatarUrl);
  } catch (err) {
    console.error('[leave-card] Gagal load avatar:', err);
    avatar = null;
  }

  const avatarRadius = 150;
  const avatarX = width / 2;
  const avatarY = height * 0.33;

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2, true);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#ed4245';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#ed4245';
  ctx.font = 'bold 96px Sans-Serif';
  const goodbyeTextY = avatarY + avatarRadius + 80;
  ctx.fillText('GOODBYE', width / 2, goodbyeTextY);

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;

  const baseUsername =
    member.user.globalName || member.user.username || 'MEMBER';
  const username = baseUsername.toUpperCase();

  let fontSize = 54;
  ctx.font = `bold ${fontSize}px Sans-Serif`;
  let measured = ctx.measureText(username);
  const maxWidth = width - 220;

  while (measured.width > maxWidth && fontSize > 26) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Sans-Serif`;
    measured = ctx.measureText(username);
  }

  ctx.fillStyle = '#ffffff';
  const usernameY = goodbyeTextY + 70;
  ctx.fillText(username, width / 2, usernameY);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const buffer = await canvas.encode('png');
  return buffer;
}

async function updateServerStats(guild) {
  try {
    if (!guild) return;

    if (
      !SERVER_STATS_ALL_ID &&
      !SERVER_STATS_MEMBERS_ID &&
      !SERVER_STATS_BOTS_ID &&
      !SERVER_STATS_BOOSTS_ID
    ) {
      return;
    }

    try {
      await guild.members.fetch();
    } catch (err) {
      console.warn(
        '[SERVER STATS] guild.members.fetch() error:',
        err.message
      );
    }

    const totalMembers =
      typeof guild.memberCount === 'number'
        ? guild.memberCount
        : guild.members.cache.size;

    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const humans = totalMembers - bots;
    const boosts = guild.premiumSubscriptionCount ?? 0;

    const targets = [
      {
        id: SERVER_STATS_ALL_ID,
        name: `🌍 • All Members: ${totalMembers}`,
      },
      {
        id: SERVER_STATS_MEMBERS_ID,
        name: `📈 • Members: ${humans}`,
      },
      {
        id: SERVER_STATS_BOTS_ID,
        name: `🤖 • Bots: ${bots}`,
      },
      {
        id: SERVER_STATS_BOOSTS_ID,
        name: `🚀 • Boosts: ${boosts}`,
      },
    ];

    for (const t of targets) {
      if (!t.id) continue;
      const ch = guild.channels.cache.get(t.id);
      if (!ch) {
        console.warn(
          `[SERVER STATS] Channel dengan ID ${t.id} tidak ditemukan di guild ${guild.id}.`
        );
        continue;
      }
      if (ch.name !== t.name) {
        await ch.setName(t.name).catch((err) => {
          console.error(
            `[SERVER STATS] Gagal update nama channel ${t.id} di guild ${guild.id}`,
            err
          );
        });
      }
    }

    if (SERVER_STATS_CATEGORY_ID) {
      const category = guild.channels.cache.get(SERVER_STATS_CATEGORY_ID);
      if (category && category.type === ChannelType.GuildCategory) {
        for (const t of targets) {
          if (!t.id) continue;
          const ch = guild.channels.cache.get(t.id);
          if (!ch) continue;
          if (ch.parentId !== category.id) {
            await ch.setParent(category.id).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('[SERVER STATS] updateServerStats error:', err);
  }
}

/**
 * Helper universal untuk proses redeem paid key:
 * mode: "month" | "lifetime" | "any"
 */
async function redeemPaidKeyFlow(interaction, key, mode) {
  try {
    const data = await validatePaidKey(key);
    const info = data.info || null;

    if (!info) {
      await interaction.editReply({
        content: '❌ Key tidak ditemukan di database.',
      });
      return;
    }

    if (data.deleted) {
      await interaction.editReply({
        content: '❌ Key ini sudah diblokir / dihapus.',
      });
      return;
    }

    if (data.expired) {
      await interaction.editReply({
        content: '❌ Key ini sudah kadaluarsa.',
      });
      return;
    }

    if (data.valid) {
      await interaction.editReply({
        content:
          '⚠️ Key ini sudah pernah diredeem sebelumnya (sudah aktif).',
      });
      return;
    }

    const keyType = normalizeKeyType(info.type || '');
    if (!keyType) {
      await interaction.editReply({
        content:
          '⚠️ Key ini tidak memiliki tipe paket yang jelas di database. Hubungi admin untuk pengecekan manual.',
      });
      return;
    }

    if (mode === 'month' && keyType !== 'month') {
      await interaction.editReply({
        content:
          '❌ Key ini **bukan** tipe **Key Sebulan**.\n' +
          'Jika ini key lifetime, gunakan perintah `/redeemkeylifetime`.\n' +
          'Jika merasa ada kesalahan, silakan hubungi admin.',
      });
      return;
    }

    if (mode === 'lifetime' && keyType !== 'lifetime') {
      await interaction.editReply({
        content:
          '❌ Key ini **bukan** tipe **Key Lifetime**.\n' +
          'Jika ini key sebulan, gunakan perintah `/redeemkeysebulan`.\n' +
          'Jika merasa ada kesalahan, silakan hubungi admin.',
      });
      return;
    }

    if (
      mode === 'any' &&
      keyType !== 'month' &&
      keyType !== 'lifetime'
    ) {
      await interaction.editReply({
        content:
          `⚠️ Key ini bertipe "${info.type}" yang belum didukung redeem otomatis dari panel.\n` +
          'Silakan hubungi admin untuk bantuan lebih lanjut.',
      });
      return;
    }

    if (
      info.ownerDiscordId &&
      String(info.ownerDiscordId) !== interaction.user.id
    ) {
      await interaction.editReply({
        content:
          '❌ Key ini terikat ke akun Discord lain.\n' +
          'Gunakan akun Discord yang sama dengan yang melakukan order.',
      });
      return;
    }

    const ownerDiscordId = info.ownerDiscordId
      ? String(info.ownerDiscordId)
      : interaction.user.id;

    const byIpSource =
      mode === 'month'
        ? 'discord-bot-redeem-month'
        : mode === 'lifetime'
        ? 'discord-bot-redeem-lifetime'
        : 'discord-bot-redeem-any';

    try {
      await createPaidKeyOnAPI(key, keyType, null, {
        valid: true,
        deleted: false,
        createdAt: info.createdAt,
        expiresAfter: info.expiresAfter,
        byIp: byIpSource,
        ownerDiscordId,
      });
    } catch (err) {
      console.error(`createPaidKeyOnAPI (redeem ${mode}) error:`, err);
      await interaction.editReply({
        content:
          'Key ditemukan, tapi gagal mengupdate status di API. Coba lagi beberapa saat lagi.',
      });
      return;
    }

    let labelType;
    if (keyType === 'month') labelType = 'Key Sebulan';
    else if (keyType === 'lifetime') labelType = 'Key Lifetime';
    else labelType = `Key tipe "${info.type || 'unknown'}"`;

    await interaction.editReply({
      content:
        `✅ ${labelType} berhasil digunakan!\n` +
        `Key: \`${key}\`\n` +
        'Terima kasih sudah menggunakan ExHub.',
    });
  } catch (err) {
    console.error(`validatePaidKey (${mode}) error:`, err);
    await interaction.editReply({
      content:
        'Terjadi kesalahan saat menghubungi API validasi key. Coba lagi beberapa saat lagi.',
    });
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  for (const [, guild] of c.guilds.cache) {
    await updateServerStats(guild);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const channelId = welcomeChannelId;
    if (!channelId) {
      await updateServerStats(member.guild);
      return;
    }

    const ch = member.guild.channels.cache.get(channelId);
    if (!ch) {
      await updateServerStats(member.guild);
      return;
    }

    let files = [];
    try {
      const imgBuffer = await generateWelcomeCard(member);
      const attachment = new AttachmentBuilder(imgBuffer, {
        name: 'welcome-card.png',
      });
      files.push(attachment);
    } catch (err) {
      console.error('[welcome-card] gagal generate kartu:', err);
    }

    const emb = new EmbedBuilder()
      .setDescription(
        `Halo ${member}, selamat datang di **${member.guild.name}**!\n` +
          'Jangan lupa baca rules & ambil role dulu di channel #✅verify.'
      )
      .setColor(0x5865f2);

    await ch.send({
      content: `<@${member.id}>`,
      embeds: [emb],
      files: files.length ? files : undefined,
    });

    await updateServerStats(member.guild);
  } catch (err) {
    console.error('Error on guildMemberAdd:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    const channelId = leaveChannelId;
    if (channelId) {
      const ch = member.guild.channels.cache.get(channelId);
      if (ch) {
        let files = [];
        try {
          const imgBuffer = await generateLeaveCard(member);
          const attachment = new AttachmentBuilder(imgBuffer, {
            name: 'leave-card.png',
          });
          files.push(attachment);
        } catch (err) {
          console.error('[leave-card] gagal generate kartu:', err);
        }

        const displayName =
          member.user.globalName || member.user.username || 'member';

        const emb = new EmbedBuilder()
          .setDescription(
            `Selamat tinggal **${displayName}**.\n` +
              `Terima kasih sudah pernah bergabung di **${member.guild.name}**.`
          )
          .setColor(0xed4245);

        await ch.send({
          embeds: [emb],
          files: files.length ? files : undefined,
        });
      }
    }

    await updateServerStats(member.guild);
  } catch (err) {
    console.error('Error on guildMemberRemove:', err);
  }
});

client.on('guildUpdate', async (oldGuild, newGuild) => {
  try {
    await updateServerStats(newGuild);
  } catch (err) {
    console.error('Error on guildUpdate:', err);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const conf = reactionRoles.get(reaction.message.id);
    if (!conf) return;

    const emojiStr = reaction.emoji.toString();
    let roleId = null;

    if (Array.isArray(conf)) {
      const found = conf.find((c) => c.emoji === emojiStr);
      if (found) roleId = found.roleId;
    } else if (conf.emoji === emojiStr) {
      roleId = conf.roleId;
    }

    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    await member.roles.add(roleId).catch(() => {});
  } catch (err) {
    console.error('messageReactionAdd error:', err);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const conf = reactionRoles.get(reaction.message.id);
    if (!conf) return;

    const emojiStr = reaction.emoji.toString();
    let roleId = null;

    if (Array.isArray(conf)) {
      const found = conf.find((c) => c.emoji === emojiStr);
      if (found) roleId = found.roleId;
    } else if (conf.emoji === emojiStr) {
      roleId = conf.roleId;
    }

    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    await member.roles.remove(roleId).catch(() => {});
  } catch (err) {
    console.error('messageReactionRemove error:', err);
  }
});

client.on('messageDelete', (message) => {
  try {
    if (!message || !message.id) return;
    if (!reactionRoles.has(message.id)) return;

    reactionRoles.delete(message.id);
    if (reactionRoleStore && reactionRoleStore[message.id]) {
      delete reactionRoleStore[message.id];
      saveReactionRoleConfig(reactionRoleStore);
    }
    console.log(
      `[ReactionRole] Removed config for deleted message ${message.id}`
    );
  } catch (err) {
    console.error('messageDelete (reaction role cleanup) error:', err);
  }
});

client.on('messageDeleteBulk', (messages) => {
  try {
    let changed = false;
    for (const [id] of messages) {
      if (reactionRoles.has(id)) {
        reactionRoles.delete(id);
        if (reactionRoleStore && reactionRoleStore[id]) {
          delete reactionRoleStore[id];
          changed = true;
        }
      }
    }
    if (changed) {
      saveReactionRoleConfig(reactionRoleStore);
      console.log(
        '[ReactionRole] Cleaned up some reaction-role messages from bulk delete'
      );
    }
  } catch (err) {
    console.error('messageDeleteBulk (reaction role cleanup) error:', err);
  }
});

async function sendStorePanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 ExHub Paid Scripts 🎮 ')
    .setDescription(
      'Hi! Welcome to **EXHUB [BETA]** 👋\n\n' +
        'Looking for premium Roblox scripts? You’ve come to the right place!\n\n' +
        '✨ High-quality scripts\n' +
        '💰 Very affordable prices\n' +
        '⚡ Fast response from the admins\n\n' +
        'Click the **📩 Create Ticket** button below to start your order :D\n' +
        'We’re ready to help you 24/7 🙂'

    )
    .setColor(0x2b2d31);

  const btn = new ButtonBuilder()
    .setCustomId('store_create_ticket')
    .setEmoji('📩')
    .setLabel('Create Ticket')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);

  await channel.send({ embeds: [embed], components: [row] });
}

async function sendControlPanel(channel, guild) {
  const embed = new EmbedBuilder()
    .setTitle('ExHub Control Panel')
    .setDescription(
      'This control panel is for the project: **ExHub**.\n\n' +
        'Got a key? redeem it right here. If you bought one but are missing your premium role, just hit the **Claim Role** button.\n\n' +
        'Feel free to check out the other buttons in this panel depending on what roles you have.'
    )
    .setColor(0x2b2d31);

  if (guild && guild.iconURL()) {
    embed.setThumbnail(guild.iconURL({ size: 256 }));
  }

  const btnRedeem = new ButtonBuilder()
    .setCustomId('control_redeem_key')
    .setLabel('Redeem Key')
    .setEmoji('🔑')
    .setStyle(ButtonStyle.Primary);

  const btnGetScript = new ButtonBuilder()
    .setCustomId('control_get_script')
    .setLabel('Get Script')
    .setEmoji('📜')
    .setStyle(ButtonStyle.Success);

  const btnCheckKey = new ButtonBuilder()
    .setCustomId('control_check_key')
    .setLabel('Check Key')
    .setEmoji('🔎')
    .setStyle(ButtonStyle.Secondary);

  const btnResetHwid = new ButtonBuilder()
    .setCustomId('control_reset_hwid')
    .setLabel('Reset HWID')
    .setEmoji('♻️')
    .setStyle(ButtonStyle.Danger);

  const btnClaimRole = new ButtonBuilder()
    .setCustomId('control_claim_role')
    .setLabel('Claim Role')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const btnGetStats = new ButtonBuilder()
    .setCustomId('control_get_stats')
    .setLabel('Get Stats')
    .setEmoji('📊')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(
    btnRedeem,
    btnGetScript,
    btnCheckKey,
    btnResetHwid
  );

  const row2 = new ActionRowBuilder().addComponents(
    btnClaimRole,
    btnGetStats
  );

  await channel.send({ embeds: [embed], components: [row1, row2] });
}

/**
 * PANEL BARU: pilih metode pembayaran (IDR / Server Booster)
 */
async function sendTicketPaymentMethodIntro(channel, user) {
  const desc = [
    `Halo ${user}, terima kasih telah membuat ticket order paid key.`,
    '',
    '**Pilih Metode Pembayaran**',
    '🇮🇩 **Order Paid Key ID (Rupiah)** — Pembayaran via QRIS (transfer Rupiah).',
    '🚀 **Order Paid Key EN (Server Booster)** — Payment using Nitro Server Boost.',
    '',
    'Please select a payment method from the menu below to continue.',
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✨ Ticket Order Paid Key ✨')
    .setDescription(desc)
    .setColor(0x2b2d31);

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select_payment_method')
    .setPlaceholder('💳 Please select a payment method')
    .addOptions(
      {
        label: 'Order Paid Key ID (Rupiah)',
        description: 'Bayar dengan Rupiah (QRIS)',
        value: 'PAY_IDR',
        emoji: '🇮🇩',
      },
      {
        label: 'Order Paid Key EN (Server Booster)',
        description: 'Pay with Nitro Server Boost (EN / Global)',
        value: 'PAY_BOOST',
        emoji: '🚀',
      }
    );

  const rowSelect = new ActionRowBuilder().addComponents(select);

  const btnCancel = new ButtonBuilder()
    .setCustomId('ticket_cancel')
    .setLabel('Cancel Order')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const btnConfirm = new ButtonBuilder()
    .setCustomId('ticket_confirm')
    .setLabel('Confirm Order')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const btnClose = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const rowButtons = new ActionRowBuilder().addComponents(
    btnCancel,
    btnConfirm,
    btnClose
  );

  await channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [rowSelect, rowButtons],
  });
}

/**
 * PANEL LAMA: Rupiah (QRIS) – tetap dipakai untuk jalur IDR
 * Sekarang support:
 * - Key Sebulan
 * - Key 3 Bulan (opsional)
 * - Key 6 Bulan (opsional)
 * - Key Lifetime (opsional)
 * - Indo Hangout Premium
 *
 * Lifetime / 3 Bulan / 6 Bulan bisa di-hide runtime via command:
 * /disablepricelifetime, /disableprice3month, /disableprice6month
 */
async function sendTicketIntroMessage(channel, user) {
  const availableLines = [];

  // list yang muncul di deskripsi tergantung flag disable
  availableLines.push(
    `⚡ Key Sebulan – Rp ${formatRupiah(
      priceKeyMonth
    )} (2 Script Premium • 30 hari)`
  );

  if (!disable3MonthInDropdown) {
    availableLines.push(
      `📆 Key 3 Bulan – Rp ${formatRupiah(
        priceKey3Month
      )} (2 Script Premium • 90 hari)`
    );
  }

  if (!disable6MonthInDropdown) {
    availableLines.push(
      `🗓️ Key 6 Bulan – Rp ${formatRupiah(
        priceKey6Month
      )} (2 Script Premium • 180 hari)`
    );
  }

  if (!disableLifetimeInDropdown) {
    availableLines.push(
      `🔥 Key Lifetime – Rp ${formatRupiah(
        priceKeyLifetime
      )} (2 Script Premium • 1 tahun)`
    );
  }

  availableLines.push(
    `🇮🇩 Indo Hangout Premium – Rp ${formatRupiah(
      priceIndoHangout
    )} (1 Username • Permanent)`
  );

  const desc = [
    `Halo ${user}, terima kasih telah membuat ticket order VIP.`,
    '',
    '**Paket Tersedia**',
    ...availableLines,
    '',
    '**Langkah Selanjutnya**',
    '1. Pilih paket dari dropdown list menu di bawah.',
    '2. Ikuti instruksi yang muncul.',
    '3. Upload bukti bayar (screenshot QRIS) di channel ini.',
    '4. Tunggu konfirmasi admin ✅',
    '',
    '⚠️ Jika button tidak muncul, kirim pesan apa saja di channel ini untuk refresh.',
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✨ Ticket Order Paid Key ✨')
    .setDescription(desc)
    .setColor(0xfee75c);

  // build opsi dropdown secara dinamis
  const options = [
    {
      label: 'Key Sebulan',
      description: `Rp ${formatRupiah(
        priceKeyMonth
      )} • 2 Script Premium (30 hari)`,
      value: 'KEY_MONTH',
      emoji: '⚡',
    },
  ];

  if (!disable3MonthInDropdown) {
    options.push({
      label: 'Key 3 Bulan',
      description: `Rp ${formatRupiah(
        priceKey3Month
      )} • 2 Script Premium (90 hari)`,
      value: 'KEY_3MONTH',
      emoji: '📆',
    });
  }

  if (!disable6MonthInDropdown) {
    options.push({
      label: 'Key 6 Bulan',
      description: `Rp ${formatRupiah(
        priceKey6Month
      )} • 2 Script Premium (180 hari)`,
      value: 'KEY_6MONTH',
      emoji: '🗓️',
    });
  }

  if (!disableLifetimeInDropdown) {
    options.push({
      label: 'Key Lifetime',
      description: `Rp ${formatRupiah(
        priceKeyLifetime
      )} • 2 Script Premium (1 tahun)`,
      value: 'KEY_LIFE',
      emoji: '🔥',
    });
  }

  options.push({
    label: 'Indo Hangout Premium',
    description: `Rp ${formatRupiah(
      priceIndoHangout
    )} • 1 Username (Permanent)`,
    value: 'INDO_VIP',
    emoji: '🇮🇩',
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select_package')
    .setPlaceholder('📦 Silahkan pilih orderan Anda')
    .addOptions(...options);

  const rowSelect = new ActionRowBuilder().addComponents(select);

  const btnCancel = new ButtonBuilder()
    .setCustomId('ticket_cancel')
    .setLabel('Cancel Order')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const btnConfirm = new ButtonBuilder()
    .setCustomId('ticket_confirm')
    .setLabel('Confirm Order')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const btnClose = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const rowButtons = new ActionRowBuilder().addComponents(
    btnCancel,
    btnConfirm,
    btnClose
  );

  await channel.send({
    embeds: [embed],
    components: [rowSelect, rowButtons],
  });
}

/**
 * PANEL BARU: Server Booster EN
 */
async function sendTicketIntroMessage2(channel, user) {
  const desc = [
    `Hi ${user}, thanks for opening a **Server Booster** order ticket.`,
    '',
    '**Available Packages**',
    '🚀 Key 1 Month – 3x Server Booster (30 days access)',
    '🚀 Key 3 Months – 5x Server Booster (90 days access)',
    '',
    '**Next Steps**',
    '1. Choose your package from the dropdown below.',
    '2. Boost this server according to the requirement.',
    '3. Send screenshots of your active boosts in this ticket channel.',
    '4. Wait for staff to verify and deliver your key.',
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✨ Ticket Order Paid Key — Server Booster ✨')
    .setDescription(desc)
    .setColor(0x5865f2);

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select_boost_package')
    .setPlaceholder('📦 Please select your order')
    .addOptions(
      {
        label: 'Key 1 Month',
        description: '3x Server Booster (30 days)',
        value: 'BOOST_1M',
        emoji: '🚀',
      },
      {
        label: 'Key 3 Months',
        description: '5x Server Booster (90 days)',
        value: 'BOOST_3M',
        emoji: '🚀',
      }
    );

  const rowSelect = new ActionRowBuilder().addComponents(select);

  const btnCancel = new ButtonBuilder()
    .setCustomId('ticket_cancel')
    .setLabel('Cancel Order')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const btnConfirm = new ButtonBuilder()
    .setCustomId('ticket_confirm')
    .setLabel('Confirm Order')
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const btnClose = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const rowButtons = new ActionRowBuilder().addComponents(
    btnCancel,
    btnConfirm,
    btnClose
  );

  await channel.send({
    embeds: [embed],
    components: [rowSelect, rowButtons],
  });
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      const ensureOwner = async () => {
        if (!isOwner(interaction.user.id)) {
          await interaction.reply({
            content: 'Perintah ini hanya bisa digunakan oleh OWNER bot.',
            flags: MessageFlags.Ephemeral,
          });
          return false;
        }
        return true;
      };

      if (commandName === 'sendticketpanel') {
        if (!(await ensureOwner())) return;
        await sendStorePanel(interaction.channel);
        await interaction.reply({
          content: 'Panel ticket store sudah dikirim di channel ini.',
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'sendcontrolpanel') {
        if (!(await ensureOwner())) return;
        await sendControlPanel(interaction.channel, interaction.guild);
        await interaction.reply({
          content: 'Control panel utama sudah dikirim di channel ini.',
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'setharga_sebulan') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceKeyMonth = harga;
        await interaction.reply({
          content: `Harga **Key Sebulan** di-set ke Rp ${formatRupiah(harga)}.`,
          flags: MessageFlags.Ephemeral,
        });
            } else if (commandName === 'disablepricelifetime') {
        if (!(await ensureOwner())) return;
        const disabled = interaction.options.getBoolean('disabled', true);
        disableLifetimeInDropdown = disabled;

        await interaction.reply({
          content: disabled
            ? 'Paket **Key Lifetime** sekarang disembunyikan dari dropdown ticket.'
            : 'Paket **Key Lifetime** sekarang ditampilkan kembali di dropdown ticket.',
          flags: MessageFlags.Ephemeral,
        });

      } else if (commandName === 'disableprice3month') {
        if (!(await ensureOwner())) return;
        const disabled = interaction.options.getBoolean('disabled', true);
        disable3MonthInDropdown = disabled;

        await interaction.reply({
          content: disabled
            ? 'Paket **Key 3 Bulan** sekarang disembunyikan dari dropdown ticket.'
            : 'Paket **Key 3 Bulan** sekarang ditampilkan kembali di dropdown ticket.',
          flags: MessageFlags.Ephemeral,
        });

      } else if (commandName === 'disableprice6month') {
        if (!(await ensureOwner())) return;
        const disabled = interaction.options.getBoolean('disabled', true);
        disable6MonthInDropdown = disabled;

        await interaction.reply({
          content: disabled
            ? 'Paket **Key 6 Bulan** sekarang disembunyikan dari dropdown ticket.'
            : 'Paket **Key 6 Bulan** sekarang ditampilkan kembali di dropdown ticket.',
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'setharga_lifetime') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceKeyLifetime = harga;
        await interaction.reply({
          content: `Harga **Key Lifetime** di-set ke Rp ${formatRupiah(
            harga
          )}.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'setharga_indohangout') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceIndoHangout = harga;
        await interaction.reply({
          content: `Harga **Indo Hangout Premium** di-set ke Rp ${formatRupiah(
            harga
          )}.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'generatekeysebulan') {
        if (!(await ensureOwner())) return;
        const target = interaction.options.getUser('member', false);
        const key = generatePaidKey();
        const days = 30;
        const ms = days * 24 * 60 * 60 * 1000;

        const ownerDiscordId = resolveKeyOwnerDiscordId(interaction, target);

        const channelMention =
          interaction.channel &&
          interaction.channel.type === ChannelType.GuildText
            ? `<#${interaction.channel.id}>`
            : 'channel ticket kamu di server';

        try {
          await createPaidKeyOnAPI(key, 'month', ms, {
            valid: false,
            byIp: 'discord-bot-generate-month',
            ownerDiscordId,
          });
        } catch (err) {
          console.error('createPaidKeyOnAPI (month) error:', err);
        }

        const expiresTs = Math.floor((Date.now() + ms) / 1000);
        const msg =
          `🎟️ Key Sebulan:\n\`${key}\`\n` +
          `Expired: <t:${expiresTs}:R> • <t:${expiresTs}:f>\n` +
          `Silakan redeem key ini menggunakan perintah \`/redeemkeysebulan\` di ${channelMention}.`;

        if (target) {
          await target
            .send({ content: msg })
            .catch(() => console.warn('Failed to DM user key.'));
          await interaction.reply({
            content: `Key sebulan dikirim ke DM ${target}.`,
            flags: MessageFlags.Ephemeral,
          });

          if (
            interaction.channel &&
            interaction.channel.type === ChannelType.GuildText
          ) {
            await interaction.channel.send({
              content: `✅ Silakan cek DM ${target}, key sudah saya kirim. Balik ke ${channelMention} untuk redeem dengan \`/redeemkeysebulan\`.`,
            });
          }
        } else {
          await interaction.reply({
            content: msg,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (commandName === 'generatekeylifetime') {
        if (!(await ensureOwner())) return;
        const target = interaction.options.getUser('member', false);
        const key = generatePaidKey();
        const days = 365;
        const ms = days * 24 * 60 * 60 * 1000;

        const ownerDiscordId = resolveKeyOwnerDiscordId(interaction, target);

        const channelMention =
          interaction.channel &&
          interaction.channel.type === ChannelType.GuildText
            ? `<#${interaction.channel.id}>`
            : 'channel ticket kamu di server';

        try {
          await createPaidKeyOnAPI(key, 'lifetime', ms, {
            valid: false,
            byIp: 'discord-bot-generate-lifetime',
            ownerDiscordId,
          });
        } catch (err) {
          console.error('createPaidKeyOnAPI (lifetime) error:', err);
        }

        const expiresTs = Math.floor((Date.now() + ms) / 1000);
        const msg =
          `🎟️ Key Lifetime:\n\`${key}\`\n` +
          `Expired: <t:${expiresTs}:R> • <t:${expiresTs}:f>\n` +
          `Silakan redeem key ini menggunakan perintah \`/redeemkeylifetime\` di ${channelMention}.`;

        if (target) {
          await target
            .send({ content: msg })
            .catch(() => console.warn('Failed to DM user key.'));
          await interaction.reply({
            content: `Key lifetime dikirim ke DM ${target}.`,
            flags: MessageFlags.Ephemeral,
          });

          if (
            interaction.channel &&
            interaction.channel.type === ChannelType.GuildText
          ) {
            await interaction.channel.send({
              content: `✅ Silakan cek DM ${target}, key sudah saya kirim. Balik ke ${channelMention} untuk redeem dengan \`/redeemkeylifetime\`.`,
            });
          }
        } else {
          await interaction.reply({
            content: msg,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (commandName === 'redeemkeysebulan') {
        const modal = new ModalBuilder()
          .setCustomId('modal_redeem_key_month')
          .setTitle('Redeem Key Sebulan');

        const input = new TextInputBuilder()
          .setCustomId('field_key_month')
          .setLabel('Masukkan Key Sebulan')
          .setPlaceholder('EXHUBPAID-XXXX')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
      } else if (commandName === 'redeemkeylifetime') {
        const modal = new ModalBuilder()
          .setCustomId('modal_redeem_key_life')
          .setTitle('Redeem Key Lifetime');

        const input = new TextInputBuilder()
          .setCustomId('field_key_life')
          .setLabel('Masukkan Key Lifetime')
          .setPlaceholder('EXHUBPAID-XXXX')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
      } else if (commandName === 'setwelcomechannel') {
        if (!(await ensureOwner())) return;
        const ch = interaction.options.getChannel('channel', true);
        welcomeChannelId = ch.id;
        await interaction.reply({
          content: `Welcome channel di-set ke ${ch}.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'setleavechannel') {
        if (!(await ensureOwner())) return;
        const ch = interaction.options.getChannel('channel', true);
        leaveChannelId = ch.id;
        await interaction.reply({
          content: `Leave channel di-set ke ${ch}.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'changenamechannel') {
        if (!(await ensureOwner())) return;
        const targetChannel = interaction.options.getChannel('channel', true);
        const newName = interaction.options.getString('name', true).trim();

        if (!newName) {
          await interaction.reply({
            content: 'Nama channel baru tidak boleh kosong.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!targetChannel || typeof targetChannel.setName !== 'function') {
          await interaction.reply({
            content:
              'Channel yang dipilih tidak bisa diubah namanya. Pastikan itu channel biasa (text / voice / announcement).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        try {
          await targetChannel.setName(newName);
          await interaction.reply({
            content: `✅ Nama channel ${targetChannel} berhasil diubah menjadi \`${newName}\`.`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (err) {
          console.error('/changenamechannel error:', err);
          await interaction.reply({
            content:
              'Gagal mengubah nama channel. Pastikan bot punya izin **Manage Channels**.',
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (commandName === 'refreshserverstats') {
        if (!(await ensureOwner())) return;
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya bisa digunakan di dalam server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        await updateServerStats(interaction.guild);
        await interaction.editReply({
          content:
            'SERVER STATS berhasil di-refresh. Jika nama channel belum berubah, cek kembali ID channel di `.env`.',
        });
      } else if (commandName === 'sendreactionrole') {
        if (!(await ensureOwner())) return;

        const rawConfigText = interaction.options.getString('config', true);
        const channelsText = interaction.options.getString('channels', false);

        let contentText =
          interaction.options.getString('content', false) ||
          'React dengan emoji berikut untuk mendapatkan role:';

        let configText = rawConfigText;
        const hashIdx = rawConfigText.indexOf('#');
        if (hashIdx !== -1) {
          configText = rawConfigText.slice(0, hashIdx).trim();
          const inlineContent = rawConfigText.slice(hashIdx + 1).trim();
          if (inlineContent) {
            contentText = inlineContent;
          }
        } else {
          configText = rawConfigText.trim();
        }

        if (!configText) {
          await interaction.reply({
            content:
              'Config kosong. Contoh: `🇮🇩 ; @MemberID , 🇺🇸 ; @MemberEN #✅verify Lets verify`',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        let segments;
        if (configText.includes('\n')) {
          segments = configText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        } else {
          segments = configText
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean);
        }

        const parsed = [];
        const errors = [];

        for (let i = 0; i < segments.length; i++) {
          const part = segments[i];
          if (!part) continue;

          let sepIdx = part.indexOf(';');

          if (sepIdx === -1 && configText.includes('\n')) {
            sepIdx = part.indexOf(',');
          }

          if (sepIdx === -1) {
            errors.push(
              `Bagian ${i + 1}: format harus \`emoji ; @Role\`. Contoh: 🇮🇩 ; @MemberID`
            );
            continue;
          }

          const emojiPart = part.slice(0, sepIdx).trim();
          const rolePart = part.slice(sepIdx + 1).trim();

          if (!emojiPart || !rolePart) {
            errors.push(
              `Bagian ${i + 1}: format harus \`emoji ; @Role\`. Contoh: 🇺🇸 ; @MemberEN`
            );
            continue;
          }

          let roleId = null;
          const mentionMatch = rolePart.match(/^<@&(\d+)>$/);
          if (mentionMatch) {
            roleId = mentionMatch[1];
          } else if (/^\d{5,}$/.test(rolePart)) {
            roleId = rolePart;
          } else {
            const roleByName = interaction.guild.roles.cache.find(
              (r) => r.name.toLowerCase() === rolePart.toLowerCase()
            );
            if (roleByName) {
              roleId = roleByName.id;
            }
          }

          if (!roleId) {
            errors.push(
              `Bagian ${i + 1}: role "${rolePart}" tidak ditemukan di server.`
            );
            continue;
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            errors.push(
              `Bagian ${i + 1}: role ID ${roleId} tidak valid / tidak ada.`
            );
            continue;
          }

          parsed.push({
            emoji: emojiPart,
            roleId: role.id,
            roleName: role.name,
          });
        }

        if (!parsed.length) {
          await interaction.reply({
            content:
              'Tidak ada pasangan emoji–role yang valid.\n' +
              'Contoh penggunaan: `/sendreactionrole config: 🇮🇩 ; @MemberID , 🇺🇸 ; @MemberEN #✅verify Lets verify`',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const targetChannels = [];
        if (channelsText) {
          const tokens = channelsText
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter(Boolean);
          const seen = new Set();

          for (const token of tokens) {
            let id = token;
            const m = token.match(/^<#(\d+)>$/);
            if (m) id = m[1];
            if (!/^\d{5,}$/.test(id)) continue;
            if (seen.has(id)) continue;
            const ch = interaction.guild.channels.cache.get(id);
            if (!ch || ch.type !== ChannelType.GuildText) continue;
            seen.add(id);
            targetChannels.push(ch);
          }
        }

        if (!targetChannels.length) {
          if (
            !interaction.channel ||
            interaction.channel.type !== ChannelType.GuildText
          ) {
            await interaction.reply({
              content:
                'Tidak ada channel valid dan perintah tidak dijalankan di text channel. Periksa opsi `channels`.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          targetChannels.push(interaction.channel);
        }

        await interaction.deferReply({ ephemeral: true });

        const createdMessages = [];
        const embedDescription = parsed
          .map((p) => `${p.emoji} → <@&${p.roleId}>`)
          .join('\n');

        for (const ch of targetChannels) {
          const embed = new EmbedBuilder()
            .setTitle('Reaction Role')
            .setDescription(embedDescription)
            .setColor(0x5865f2);

          const msg = await ch.send({
            content: contentText,
            embeds: [embed],
          });

          createdMessages.push(msg);

          for (const p of parsed) {
            try {
              await msg.react(p.emoji);
            } catch (err) {
              console.error('Gagal menambahkan reaction pada pesan:', err);
            }
          }

          const msgConfig = parsed.map((p) => ({
            emoji: p.emoji,
            roleId: p.roleId,
            roleName: p.roleName,
          }));

          reactionRoles.set(msg.id, msgConfig);
          reactionRoleStore[msg.id] = msgConfig;
          saveReactionRoleConfig(reactionRoleStore);
        }

        const uniqueChannels = [
          ...new Set(createdMessages.map((m) => `<#${m.channel.id}>`)),
        ];

        let replyText = `Reaction role dibuat di ${uniqueChannels.join(', ')}.`;
        if (errors.length) {
          replyText +=
            '\n\nBeberapa bagian dilewati karena error:\n' +
            errors
              .slice(0, 5)
              .map((e) => `• ${e}`)
              .join('\n');
        }

        await interaction.editReply({ content: replyText });
      } else if (commandName === 'sendupdatesc') {
        if (!(await ensureOwner())) return;

        if (!interaction.guild) {
          await interaction.reply({
            content:
              'Perintah ini hanya bisa digunakan di dalam server (bukan DM).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const scriptName = interaction.options.getString('script', true);
        const status = interaction.options.getString('status', true);
        const features = interaction.options.getString('features', true);
        const changelogs = interaction.options.getString('changelogs', true);
        const nextUpdate =
          interaction.options.getString('nextupdate', false) || '-';
        const targetChannelOpt =
          interaction.options.getChannel('channel', false);

        let targetChannel = null;

        if (
          targetChannelOpt &&
          (targetChannelOpt.type === ChannelType.GuildText ||
            targetChannelOpt.type === ChannelType.GuildAnnouncement)
        ) {
          targetChannel = targetChannelOpt;
        } else if (UPDATE_CHANNEL_ID) {
          const ch = interaction.guild.channels.cache.get(UPDATE_CHANNEL_ID);
          if (
            ch &&
            (ch.type === ChannelType.GuildText ||
              ch.type === ChannelType.GuildAnnouncement)
          ) {
            targetChannel = ch;
          }
        }

        if (!targetChannel) {
          targetChannel = interaction.channel;
        }

        if (!targetChannel || typeof targetChannel.send !== 'function') {
          await interaction.reply({
            content:
              'Channel tujuan tidak valid untuk mengirim pesan (bukan text/announcement channel).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const payload = buildScriptUpdatePayload(
          {
            scriptName,
            status,
            features,
            changeLogs: changelogs,
            nextUpdate,
          },
          interaction.guild,
          client
        );

        await targetChannel.send(payload);

        await interaction.reply({
          content: `Pengumuman NEW UPDATE SC sudah dikirim ke ${targetChannel}.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'runtime') {
        const msg = buildRuntimeMessage(client);
        await interaction.reply({
          content: msg,
          flags: MessageFlags.Ephemeral,
        });
      } else if (commandName === 'mykey' || commandName === 'checkmykey') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const keys = await fetchUserPaidKeys(interaction.user);

          if (!keys || keys.length === 0) {
            await interaction.editReply({
              content:
                'Saat ini tidak ada paid key yang tercatat atas akun Discord kamu. Jika merasa sudah pernah order, hubungi admin dengan menyertakan bukti pembayaran.',
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('🔑 Key Information — Akun Kamu')
            .setDescription(
              'Berikut seluruh **paid key** yang terikat ke akun Discord kamu berdasarkan data di API ExHub.'
            )
            .setColor(0x5865f2);

          const maxShow = 10;
          const slice = keys.slice(0, maxShow);

          slice.forEach((k, idx) => {
            const createdTs = k.createdAtMs
              ? Math.floor(k.createdAtMs / 1000)
              : null;
            const expireTs = k.expiresAfterMs
              ? Math.floor(k.expiresAfterMs / 1000)
              : null;

            let paidLabel;
            if (k.type === 'month') paidLabel = 'Month (Sebulan)';
            else if (k.type === 'lifetime') paidLabel = 'Lifetime';
            else if (k.type) paidLabel = k.type;
            else paidLabel = 'Paid';

            const lines = [];
            lines.push(`**Your Key:** \`${k.token}\``);

            if (createdTs) {
              lines.push(
                `**Order Key:** <t:${createdTs}:f> • <t:${createdTs}:R>`
              );
            } else {
              lines.push('**Order Key:** -');
            }

            if (expireTs) {
              lines.push(
                `**Expired Date:** <t:${expireTs}:f> • <t:${expireTs}:R>`
              );
            } else {
              lines.push('**Expired Date:** -');
            }

            lines.push(`**Paid Plan:** ${paidLabel}`);
            lines.push(`**Status:** ${k.status}`);

            embed.addFields({
              name: `Key #${idx + 1}`,
              value: lines.join('\n'),
              inline: false,
            });
          });

          if (keys.length > maxShow) {
            embed.setFooter({
              text: `Menampilkan ${maxShow} dari ${keys.length} key. Gunakan dashboard web untuk detail lengkap.`,
            });
          }

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('/mykey error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat mengambil data key dari API. Coba lagi beberapa saat lagi atau hubungi admin.',
          });
        }
      }

      return;
    }

    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId === 'control_redeem_key') {
        const modal = new ModalBuilder()
          .setCustomId('modal_redeem_key_any')
          .setTitle('Redeem Paid Key');

        const input = new TextInputBuilder()
          .setCustomId('field_key_any')
          .setLabel('Masukkan Key Sebulan / Lifetime')
          .setPlaceholder('EXHUBPAID-XXXX')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
        return;
      }

      if (customId === 'control_get_script') {
        const scriptLine =
          'loadstring(game:HttpGet("https://exc-webs.vercel.app/api/script/spear-fishing", true))()';

        const msg =
          '**Desktop Executor**\n' +
          '```lua\n' +
          scriptLine +
          '\n```\n' +
          '**Mobile (Tap to Copy)**\n' +
          '`' +
          scriptLine +
          '`';

        await interaction.reply({
          content: msg,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (customId === 'control_check_key') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const info = await fetchUserKeyInfo(interaction.user);
          const { paidKeys, freeKeys, allKeys } = info;

          if (!allKeys.length) {
            await interaction.editReply({
              content:
                'Tidak ada key (paid maupun free) yang tercatat atas akun Discord kamu.',
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('🔑 Your Keys')
            .setDescription(
              'Ringkasan key paid & free yang terikat ke akun Discord kamu.'
            )
            .setColor(0x5865f2);

          const maxPaid = Math.min(paidKeys.length, 6);
          const maxFree = Math.min(freeKeys.length, 6);

          if (paidKeys.length) {
            for (let i = 0; i < maxPaid; i++) {
              const k = paidKeys[i];
              const createdTs = k.createdAtMs
                ? Math.floor(k.createdAtMs / 1000)
                : null;
              const expireTs = k.expiresAfterMs
                ? Math.floor(k.expiresAfterMs / 1000)
                : null;

              let paidLabel;
              if (k.type === 'month') paidLabel = 'Month (Sebulan)';
              else if (k.type === 'lifetime') paidLabel = 'Lifetime';
              else if (k.type) paidLabel = k.type;
              else paidLabel = 'Paid';

              const lines = [];
              lines.push(`**Key:** \`${k.token}\``);
              lines.push(`**Plan:** ${paidLabel}`);
              if (createdTs) {
                lines.push(`**Order:** <t:${createdTs}:f>`);
              }
              if (expireTs) {
                lines.push(
                  `**Expired:** <t:${expireTs}:f> • <t:${expireTs}:R>`
                );
              }
              lines.push(`**Status:** ${k.status}`);

              embed.addFields({
                name: `Paid Key #${i + 1}`,
                value: lines.join('\n'),
                inline: false,
              });
            }
          }

          if (freeKeys.length) {
            const freeByProvider = {};
            for (const k of freeKeys) {
              let prov = k.provider || 'unknown';
              if (
                prov.includes('work.ink') ||
                prov === 'work.ink' ||
                prov === 'workink'
              ) {
                prov = 'Work.ink';
              } else if (prov.includes('linkvertise')) {
                prov = 'Linkvertise';
              }
              freeByProvider[prov] = (freeByProvider[prov] || 0) + 1;
            }

            const list = Object.entries(freeByProvider)
              .map(([prov, count]) => `${prov}: **${count}**`)
              .join('\n');

            embed.addFields({
              name: 'Free Keys',
              value: list || '0',
              inline: false,
            });
          }

          if (paidKeys.length > maxPaid || freeKeys.length > maxFree) {
            embed.setFooter({
              text: `Menampilkan sebagian dari total ${allKeys.length} key. Lihat dashboard web untuk detail lengkap.`,
            });
          }

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('control_check_key error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat membaca data key dari API. Coba lagi atau hubungi admin.',
          });
        }
        return;
      }

      if (customId === 'control_reset_hwid') {
        if (!RESET_HWID_API_URL) {
          await interaction.reply({
            content:
              'Fitur **Reset HWID** belum dikonfigurasi. Minta admin mengisi `RESET_HWID_API_URL` di `.env` bot.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_reset_hwid')
          .setTitle('Reset HWID ExHub');

        const input = new TextInputBuilder()
          .setCustomId('field_reset_hwid_key')
          .setLabel('Masukkan Paid Key (EXHUBPAID)')
          .setPlaceholder('EXHUBPAID-XXXX-XXXX-XXXX')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (customId === 'control_claim_role') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya dapat digunakan di dalam server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!PAID_ROLE_ID) {
          await interaction.reply({
            content:
              'PAID_ROLE_ID belum dikonfigurasi di .env. Minta admin untuk mengisi ID role premium.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user.id);
        const role = guild.roles.cache.get(PAID_ROLE_ID);

        if (!role) {
          await interaction.editReply({
            content:
              'Role premium (PAID_ROLE_ID) tidak ditemukan di server ini. Cek kembali konfigurasi role.',
          });
          return;
        }

        try {
          const info = await fetchUserKeyInfo(interaction.user);
          const activePaid = info.paidKeys.filter(
            (k) => k.status === 'Active'
          );

          if (!activePaid.length) {
            const orderMention = ORDER_PAID_CHANNEL_ID
              ? `<#${ORDER_PAID_CHANNEL_ID}>`
              : '#order-paid';

            await interaction.editReply({
              content:
                `❌ You don't have an active paid key.\n` +
                `Please order a paid month or lifetime key first in ${orderMention}.`,
            });
            return;
          }

          if (member.roles.cache.has(role.id)) {
            await interaction.editReply({
              content: `Kamu sudah memiliki role premium ${role}.`,
            });
            return;
          }

          await member.roles.add(role);
          await interaction.editReply({
            content: `✅ Kamu sudah diberikan role premium ${role} karena memiliki paid key aktif.`,
          });
        } catch (err) {
          console.error('control_claim_role error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat mengecek key / memberikan role. Coba lagi atau hubungi admin.',
          });
        }
        return;
      }

      if (customId === 'control_get_stats') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const info = await fetchUserKeyInfo(interaction.user);
          const { paidKeys, freeKeys, allKeys, stats } = info;

          const totalKeys = allKeys.length;
          const activePaid = paidKeys.filter((k) => k.status === 'Active');

          const monthCount = paidKeys.filter((k) => k.type === 'month').length;
          const lifeCount = paidKeys.filter(
            (k) => k.type === 'lifetime'
          ).length;
          const otherPaid = paidKeys.length - monthCount - lifeCount;

          const freeByProvider = {};
          for (const k of freeKeys) {
            let prov = k.provider || 'unknown';
            if (
              prov.includes('work.ink') ||
              prov === 'work.ink' ||
              prov === 'workink'
            ) {
              prov = 'Work.ink';
            } else if (prov.includes('linkvertise')) {
              prov = 'Linkvertise';
            }
            freeByProvider[prov] = (freeByProvider[prov] || 0) + 1;
          }

          const totalExec = stats.totalExec ?? 0;
          const executorName = stats.executorName || 'Unknown';
          const lastExecTs = stats.lastExecAtMs
            ? Math.floor(stats.lastExecAtMs / 1000)
            : null;
          const lastClaimTs = stats.lastClaimAtMs
            ? Math.floor(stats.lastClaimAtMs / 1000)
            : null;

          const embed = new EmbedBuilder()
            .setTitle('Your Stats')
            .setDescription(
              'Summary of your account statistics.\nView detailed key information via the **Check Key** button.'
            )
            .setColor(0x2b2d31);

          embed.addFields(
            {
              name: 'Total Keys',
              value: String(totalKeys),
              inline: true,
            },
            {
              name: 'Paid Keys',
              value: paidKeys.length
                ? [
                    `Total: **${paidKeys.length}**`,
                    `Month: **${monthCount}**`,
                    `Lifetime: **${lifeCount}**`,
                    otherPaid > 0 ? `Other: **${otherPaid}**` : null,
                    `Active: **${activePaid.length}**`,
                  ]
                    .filter(Boolean)
                    .join('\n')
                : '0',
              inline: true,
            },
            {
              name: 'Free Keys',
              value:
                freeKeys.length === 0
                  ? '0'
                  : Object.entries(freeByProvider)
                      .map(([prov, count]) => `${prov}: **${count}**`)
                      .join('\n'),
              inline: true,
            }
          );

          const execLines = [];
          execLines.push(`Total Executes: **${totalExec}**`);
          execLines.push(`Executor: **${executorName}**`);
          if (lastExecTs) {
            execLines.push(`Last Use: <t:${lastExecTs}:R>`);
          }
          if (stats.totalClaimed != null) {
            execLines.push(`Total Claimed: **${stats.totalClaimed}**`);
          }
          if (lastClaimTs) {
            execLines.push(`Last Claimed: <t:${lastClaimTs}:R>`);
          }
          if (stats.subscription) {
            execLines.push(`Subscription: **${stats.subscription}**`);
          }

          embed.addFields({
            name: 'Execution Stats',
            value: execLines.join('\n'),
            inline: false,
          });

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('control_get_stats error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat mengambil stats dari API. Coba lagi atau hubungi admin.',
          });
        }
        return;
      }

      if (customId === 'store_create_ticket') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya dapat digunakan di server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const cleanName =
          interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '') ||
          'user';
        const shortId = Math.floor(Math.random() * 9000) + 1000;
        const channelName = `ticket-${cleanName}-${shortId}`;

        const everyone = guild.roles.everyone;

        const permissionOverwrites = [
          {
            id: everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ];

        for (const ownerIdRaw of OWNER_IDS) {
          const id = String(ownerIdRaw).trim();
          if (!id || id === interaction.user.id) continue;

          const ownerMember = guild.members.cache.get(id);
          const ownerRole = guild.roles.cache.get(id);

          if (!ownerMember && !ownerRole) continue;

          permissionOverwrites.push({
            id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          });
        }

        const channel = await guild.channels.create({
          name: channelName.slice(0, 90),
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID || undefined,
          topic: `Ticket order by ${interaction.user.tag} | OwnerID:${interaction.user.id}`,
          permissionOverwrites,
        });

        ticketOwners.set(channel.id, interaction.user.id);

        await interaction.editReply({
          content: `Ticket kamu sudah dibuat: ${channel}`,
        });

        // PERUBAHAN: setelah ticket dibuat, kirim panel PILIH METODE PEMBAYARAN
        await sendTicketPaymentMethodIntro(channel, interaction.user);

        const logEmbed = new EmbedBuilder()
          .setTitle('🎫 Ticket Baru Dibuat')
          .addFields(
            {
              name: 'User',
              value: `${interaction.user} (${interaction.user.id})`,
            },
            { name: 'Channel', value: `${channel}` }
          )
          .setTimestamp()
          .setColor(0x5865f2);

        await logOrder(guild, logEmbed);
        return;
      }

      if (customId === 'ticket_cancel') {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content: 'Hanya pembuat ticket yang bisa membatalkan order ini.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Ticket akan dihapus dalam 3 detik...',
          flags: MessageFlags.Ephemeral,
        });

        setTimeout(() => {
          interaction.channel
            .delete('Ticket dibatalkan oleh user')
            .catch(() => {});
        }, 3000);
        return;
      }

      if (customId === 'ticket_confirm') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya dapat digunakan di dalam server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );
        if (
          !member.permissions.has(PermissionsBitField.Flags.ManageChannels) &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya admin / owner yang dapat mengkonfirmasi order ini.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const guild = interaction.guild;
        const ownerId = getTicketOwnerId(interaction.channel);
        const order = ticketOrders.get(interaction.channel.id);

        if (!order) {
          await interaction.reply({
            content:
              'Belum ada paket order yang dipilih di ticket ini. Minta user memilih paket dahulu dari dropdown yang tersedia.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        let paidLabel = 'Unknown';
        let nominal = 0;
        let expiresMs = null;
        let paymentNote = null;

        if (order && order.type === 'KEY_MONTH') {
  paidLabel = 'Key Sebulan';
  nominal = priceKeyMonth;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 30 * 24 * 60 * 60 * 1000;
} else if (order && order.type === 'KEY_3MONTH') {
  paidLabel = 'Key 3 Bulan';
  nominal = priceKey3Month;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 90 * 24 * 60 * 60 * 1000;
} else if (order && order.type === 'KEY_6MONTH') {
  paidLabel = 'Key 6 Bulan';
  nominal = priceKey6Month;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 180 * 24 * 60 * 60 * 1000;
} else if (order && order.type === 'KEY_LIFE') {
  paidLabel = 'Key Lifetime';
  nominal = priceKeyLifetime;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 365 * 24 * 60 * 60 * 1000;
} else if (order && order.type === 'INDO_VIP') {
  paidLabel = 'Indo Hangout Premium';
  nominal = priceIndoHangout;
} else if (order && order.type === 'BOOST_1M') {
  paidLabel = 'Key 1 Month (Server Booster)';
  nominal = 0;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 30 * 24 * 60 * 60 * 1000;
  paymentNote = '3x Server Booster (30 days)';
} else if (order && order.type === 'BOOST_3M') {
  paidLabel = 'Key 3 Months (Server Booster)';
  nominal = 0;
  const createdAt = order.timestamp || Date.now();
  expiresMs = createdAt + 90 * 24 * 60 * 60 * 1000;
  paymentNote = '5x Server Booster (90 days)';
}


        let expiredText = '-';
        if (expiresMs) {
          const expTs = Math.floor(expiresMs / 1000);
          expiredText = `<t:${expTs}:F>`;
        } else if (paidLabel === 'Indo Hangout Premium') {
          expiredText = 'Permanent';
        }

        const ownerMention = ownerId
          ? `<@${ownerId}>`
          : `${interaction.user}`;

        let nominalText;
        if (paymentNote) {
          nominalText = paymentNote;
        } else {
          nominalText =
            nominal && nominal > 0
              ? `Rp. ${formatRupiah(nominal)}`
              : 'Rp. -';
        }

        const content =
          '**✅️ Sukses Order Key 🔑**\n' +
          `User: ${ownerMention}\n` +
          `Paid Key: ${paidLabel}\n` +
          `Expired: ${expiredText}\n` +
          `Nominal: ${nominalText}`;

        if (!LOGPAID_CHANNEL_ID) {
          await interaction.reply({
            content:
              'LOGPAID_CHANNEL_ID belum dikonfigurasi di .env, tidak bisa mengirim log paid order.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const logChannel = guild.channels.cache.get(LOGPAID_CHANNEL_ID);
        if (!logChannel) {
          await interaction.reply({
            content:
              'Channel LOGPAID_CHANNEL_ID tidak ditemukan di server. Cek kembali konfigurasi .env.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await logPaidOrder(guild, { content });

        await interaction.reply({
          content: '✅ Order berhasil dikonfirmasi dan log telah dikirim.',
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      if (customId === 'ticket_close') {
        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );
        if (
          !member.permissions.has(PermissionsBitField.Flags.ManageChannels) &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya admin / owner yang dapat menutup ticket ini (Close Ticket).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Ticket akan ditutup (channel dihapus) dalam 3 detik...',
          flags: MessageFlags.Ephemeral,
        });

        setTimeout(() => {
          interaction.channel
            .delete('Ticket closed by staff')
            .catch(() => {});
        }, 3000);
        return;
      }

      if (customId === 'roblox_reinput' || customId === 'roblox_wrong') {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat menginput ulang username Roblox.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_roblox_username')
          .setTitle('Masukkan Username Roblox');

        const input = new TextInputBuilder()
          .setCustomId('field_roblox_username')
          .setLabel('Username Roblox')
          .setPlaceholder('Contoh: BloxGuy123')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
        return;
      }

      if (customId.startsWith('roblox_confirm_')) {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat mengkonfirmasi username ini.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = interaction.message.embeds[0];
        let usernameText = '-';
        let userIdText = '-';

        if (embed && Array.isArray(embed.fields)) {
          for (const f of embed.fields) {
            if (f.name === 'Username') usernameText = f.value;
            if (f.name === 'User ID') userIdText = f.value;
          }
        }

        const rowOld = interaction.message.components[0];
        const btn1 = ButtonBuilder.from(rowOld.components[0]).setDisabled(true);
        const btn2 = ButtonBuilder.from(rowOld.components[1]).setDisabled(true);
        const newRow = new ActionRowBuilder().addComponents(btn1, btn2);

        await interaction.update({ components: [newRow] });

        const harga = priceIndoHangout;

        const instruksi = new EmbedBuilder()
          .setTitle('✨ Instruksi Pembayaran')
          .setDescription('Scan QRIS di bawah untuk membayar')
          .addFields(
            {
              name: 'Detail Pesanan',
              value:
                `Paket   : Indo Hangout Premium\n` +
                `Username: ${usernameText}\n` +
                `User ID : ${userIdText}\n` +
                `Nominal : Rp ${formatRupiah(harga)}`,
            },
            {
              name: 'Langkah Pembayaran',
              value:
                '1. Scan QRIS di bawah dengan aplikasi pembayaran.\n' +
                '2. Bayar sesuai nominal.\n' +
                '3. Screenshot bukti bayar dan upload di channel ini.\n' +
                '4. Tunggu konfirmasi admin (maksimal 10 menit).',
            },
            {
              name: 'Jam Operasional',
              value: '08:00 - 23:00 WIB',
            }
          )
          .setColor(0xfee75c);

        if (QRIS_IMAGE_URL) {
          instruksi.setImage(QRIS_IMAGE_URL);
        }

        await interaction.followUp({ embeds: [instruksi] });

        const logEmb = new EmbedBuilder()
          .setTitle('🧾 Order Indo Hangout Premium')
          .addFields(
            {
              name: 'Discord User',
              value: `${interaction.user} (${interaction.user.id})`,
            },
            { name: 'Roblox Username', value: usernameText },
            { name: 'Roblox User ID', value: userIdText },
            { name: 'Nominal', value: `Rp ${formatRupiah(harga)}` },
            { name: 'Channel Ticket', value: `${interaction.channel}` }
          )
          .setTimestamp()
          .setColor(0x57f287);

        await logOrder(interaction.guild, logEmb);
        return;
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;

      // PILIH METODE PEMBAYARAN (IDR / BOOST)
      if (customId === 'ticket_select_payment_method') {
        const [value] = interaction.values;
        const ownerId = getTicketOwnerId(interaction.channel);

        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat memilih metode pembayaran di ticket ini.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (value === 'PAY_IDR') {
          await sendTicketIntroMessage(interaction.channel, interaction.user);
          await interaction.reply({
            content:
              '✅ Metode pembayaran **Rupiah (QRIS)** dipilih. Silahkan pilih paket di panel baru.',
            flags: MessageFlags.Ephemeral,
          });
        } else if (value === 'PAY_BOOST') {
          await sendTicketIntroMessage2(interaction.channel, interaction.user);
          await interaction.reply({
            content:
              '✅ Payment method **Server Booster** selected. Please choose your package in the new panel.',
            flags: MessageFlags.Ephemeral,
          });
        }

        return;
      }

      if (customId === 'ticket_select_package') {
  const [value] = interaction.values;
  const ownerId = getTicketOwnerId(interaction.channel);

  if (
    interaction.user.id !== ownerId &&
    !isOwner(interaction.user.id)
  ) {
    await interaction.reply({
      content:
        'Hanya pembuat ticket yang dapat memilih paket order di ticket ini.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // KEY SEBULAN
  if (value === 'KEY_MONTH') {
    const harga = priceKeyMonth;
    ticketOrders.set(interaction.channel.id, {
      type: 'KEY_MONTH',
      price: harga,
      timestamp: Date.now(),
    });

    const instruksi = new EmbedBuilder()
      .setTitle('✨ Instruksi Pembayaran — Key Sebulan')
      .setDescription('Scan QRIS di bawah untuk membayar')
      .addFields(
        {
          name: 'Detail Pesanan',
          value:
            `Paket   : Key Sebulan\n` +
            `Nominal : Rp ${formatRupiah(harga)}`,
        },
        {
          name: 'Langkah Pembayaran',
          value:
            '1. Scan QRIS di bawah dengan aplikasi pembayaran.\n' +
            '2. Bayar sesuai nominal.\n' +
            '3. Screenshot bukti bayar dan upload di channel ini.\n' +
            '4. Tunggu konfirmasi admin (maksimal 10 menit).',
        },
        {
          name: 'Jam Operasional',
          value: '08:00 - 23:00 WIB',
        }
      )
      .setColor(0xfee75c);

    if (QRIS_IMAGE_URL) {
      instruksi.setImage(QRIS_IMAGE_URL);
    }

    await interaction.reply({
      content: `✅ Silahkan mengirim bukti pembayaran anda disini ${interaction.user}`,
      embeds: [instruksi],
    });
  }

  // KEY 3 BULAN
  else if (value === 'KEY_3MONTH') {
    const harga = priceKey3Month;
    ticketOrders.set(interaction.channel.id, {
      type: 'KEY_3MONTH',
      price: harga,
      timestamp: Date.now(),
    });

    const instruksi = new EmbedBuilder()
      .setTitle('✨ Instruksi Pembayaran — Key 3 Bulan')
      .setDescription('Scan QRIS di bawah untuk membayar')
      .addFields(
        {
          name: 'Detail Pesanan',
          value:
            `Paket   : Key 3 Bulan\n` +
            `Nominal : Rp ${formatRupiah(harga)}`,
        },
        {
          name: 'Langkah Pembayaran',
          value:
            '1. Scan QRIS di bawah dengan aplikasi pembayaran.\n' +
            '2. Bayar sesuai nominal.\n' +
            '3. Screenshot bukti bayar dan upload di channel ini.\n' +
            '4. Tunggu konfirmasi admin (maksimal 10 menit).',
        },
        {
          name: 'Jam Operasional',
          value: '08:00 - 23:00 WIB',
        }
      )
      .setColor(0xfee75c);

    if (QRIS_IMAGE_URL) {
      instruksi.setImage(QRIS_IMAGE_URL);
    }

    await interaction.reply({
      content: `✅ Silahkan mengirim bukti pembayaran anda disini ${interaction.user}`,
      embeds: [instruksi],
    });
  }

  // KEY 6 BULAN
  else if (value === 'KEY_6MONTH') {
    const harga = priceKey6Month;
    ticketOrders.set(interaction.channel.id, {
      type: 'KEY_6MONTH',
      price: harga,
      timestamp: Date.now(),
    });

    const instruksi = new EmbedBuilder()
      .setTitle('✨ Instruksi Pembayaran — Key 6 Bulan')
      .setDescription('Scan QRIS di bawah untuk membayar')
      .addFields(
        {
          name: 'Detail Pesanan',
          value:
            `Paket   : Key 6 Bulan\n` +
            `Nominal : Rp ${formatRupiah(harga)}`,
        },
        {
          name: 'Langkah Pembayaran',
          value:
            '1. Scan QRIS di bawah dengan aplikasi pembayaran.\n' +
            '2. Bayar sesuai nominal.\n' +
            '3. Screenshot bukti bayar dan upload di channel ini.\n' +
            '4. Tunggu konfirmasi admin (maksimal 10 menit).',
        },
        {
          name: 'Jam Operasional',
          value: '08:00 - 23:00 WIB',
        }
      )
      .setColor(0xfee75c);

    if (QRIS_IMAGE_URL) {
      instruksi.setImage(QRIS_IMAGE_URL);
    }

    await interaction.reply({
      content: `✅ Silahkan mengirim bukti pembayaran anda disini ${interaction.user}`,
      embeds: [instruksi],
    });
  }

  // KEY LIFETIME
  else if (value === 'KEY_LIFE') {
    const harga = priceKeyLifetime;
    ticketOrders.set(interaction.channel.id, {
      type: 'KEY_LIFE',
      price: harga,
      timestamp: Date.now(),
    });

    const instruksi = new EmbedBuilder()
      .setTitle('✨ Instruksi Pembayaran — Key Lifetime')
      .setDescription('Scan QRIS di bawah untuk membayar')
      .addFields(
        {
          name: 'Detail Pesanan',
          value:
            `Paket   : Key Lifetime\n` +
            `Nominal : Rp ${formatRupiah(harga)}`,
        },
        {
          name: 'Langkah Pembayaran',
          value:
            '1. Scan QRIS di bawah dengan aplikasi pembayaran.\n' +
            '2. Bayar sesuai nominal.\n' +
            '3. Screenshot bukti bayar dan upload di channel ini.\n' +
            '4. Tunggu konfirmasi admin (maksimal 10 menit).',
        },
        {
          name: 'Jam Operasional',
          value: '08:00 - 23:00 WIB',
        }
      )
      .setColor(0xfee75c);

    if (QRIS_IMAGE_URL) {
      instruksi.setImage(QRIS_IMAGE_URL);
    }

    await interaction.reply({
      content: `✅ Silahkan mengirim bukti pembayaran anda disini ${interaction.user}`,
      embeds: [instruksi],
    });
  }

  // INDO HANGOUT
  else if (value === 'INDO_VIP') {
    ticketOrders.set(interaction.channel.id, {
      type: 'INDO_VIP',
      price: priceIndoHangout,
      timestamp: Date.now(),
    });

    const modal = new ModalBuilder()
      .setCustomId('modal_roblox_username')
      .setTitle('Masukkan Username Roblox');

    const input = new TextInputBuilder()
      .setCustomId('field_roblox_username')
      .setLabel('Username Roblox')
      .setPlaceholder('Contoh: BloxGuy123')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);
    await interaction.showModal(modal);
  }

  return;
}


      // PILIH PAKET SERVER BOOSTER
      if (customId === 'ticket_select_boost_package') {
        const [value] = interaction.values;
        const ownerId = getTicketOwnerId(interaction.channel);

        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat memilih paket order di ticket ini.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (value === 'BOOST_1M') {
          ticketOrders.set(interaction.channel.id, {
            type: 'BOOST_1M',
            price: 0,
            timestamp: Date.now(),
          });

          const instruksi = new EmbedBuilder()
            .setTitle('✨ Payment Instructions — 1 Month Key (Server Booster)')
            .setDescription(
              'Please pay using **Discord Nitro Server Boost**.\n\n' +
                '**Package Details**\n' +
                '• Key Type   : 1 Month Paid Key\n' +
                '• Requirement: 3x Server Booster on this server\n' +
                '• Access     : 30 days from activation\n\n' +
                '**Steps**\n' +
                '1. Boost this server **3 times**.\n' +
                '2. Take a screenshot of your active boosts.\n' +
                '3. Send the screenshot here.\n' +
                '4. Wait for staff to verify and send your key.'
            )
            .setColor(0x5865f2);

          await interaction.reply({
            content: `✅ Please pay with **3x Server Booster** and send screenshots here ${interaction.user}`,
            embeds: [instruksi],
          });
        } else if (value === 'BOOST_3M') {
          ticketOrders.set(interaction.channel.id, {
            type: 'BOOST_3M',
            price: 0,
            timestamp: Date.now(),
          });

          const instruksi = new EmbedBuilder()
            .setTitle('✨ Payment Instructions — 3 Months Key (Server Booster)')
            .setDescription(
              'Please pay using **Discord Nitro Server Boost**.\n\n' +
                '**Package Details**\n' +
                '• Key Type   : 3 Months Paid Key\n' +
                '• Requirement: 5x Server Booster on this server\n' +
                '• Access     : 90 days from activation\n\n' +
                '**Steps**\n' +
                '1. Boost this server **5 times**.\n' +
                '2. Take a screenshot of your active boosts.\n' +
                '3. Send the screenshot here.\n' +
                '4. Wait for staff to verify and send your key.'
            )
            .setColor(0x5865f2);

          await interaction.reply({
            content: `✅ Please pay with **5x Server Booster** and send screenshots here ${interaction.user}`,
            embeds: [instruksi],
          });
        }

        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (customId === 'modal_roblox_username') {
        await interaction.deferReply({ ephemeral: true });

        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.editReply({
            content:
              'Hanya pembuat ticket yang dapat menginput username Roblox.',
          });
          return;
        }

        const username = interaction.fields
          .getTextInputValue('field_roblox_username')
          .trim();

        if (!username) {
          await interaction.editReply({
            content: 'Username tidak boleh kosong.',
          });
          return;
        }

        try {
          const roblox = await lookupRobloxUser(username);

          if (!roblox) {
            await interaction.editReply({
              content:
                '❌ Username tidak ditemukan. Lihat panel di bawah untuk panduan dan input ulang.',
            });

            const embed = new EmbedBuilder()
              .setTitle('✨ Username Tidak Ditemukan')
              .setDescription(
                `Username \`${username}\` tidak ditemukan di Roblox.`
              )
              .addFields(
                {
                  name: 'Kemungkinan Penyebab',
                  value:
                    '• Username salah ketik\n' +
                    '• Menggunakan Display Name (bukan Username)\n' +
                    '• Akun Roblox tidak ada\n' +
                    '• Ada spasi atau karakter khusus',
                },
                {
                  name: 'Cara Cek Username Roblox',
                  value:
                    '1. Buka profil Roblox Anda.\n' +
                    '2. Username ada di `@username` (bukan Display Name).\n' +
                    '3. Contoh: Display `John` → Username `@john123`.',
                }
              )
              .setColor(0xed4245);

            const btn = new ButtonBuilder()
              .setCustomId('roblox_reinput')
              .setLabel('Input Username Lagi')
              .setEmoji('🔁')
              .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(btn);

            await interaction.channel.send({
              embeds: [embed],
              components: [row],
            });
          } else {
            await interaction.editReply({
              content:
                '✅ Username terverifikasi! Lihat panel di bawah untuk konfirmasi.',
            });

            const embed = new EmbedBuilder()
              .setTitle('✨ Username Ditemukan')
              .setDescription(`${roblox.name} (@${username})`)
              .addFields(
                { name: 'Username', value: roblox.name, inline: true },
                {
                  name: 'Display Name',
                  value: roblox.displayName || '-',
                  inline: true,
                },
                {
                  name: 'User ID',
                  value: String(roblox.id),
                  inline: true,
                }
              )
              .setThumbnail(robloxAvatarUrl(roblox.id))
              .setColor(0x57f287);

            const btnYes = new ButtonBuilder()
              .setCustomId(`roblox_confirm_${roblox.id}`)
              .setLabel('Ya, Benar!')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success);

            const btnNo = new ButtonBuilder()
              .setCustomId('roblox_wrong')
              .setLabel('Salah, Input Ulang')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(btnYes, btnNo);

            await interaction.channel.send({
              embeds: [embed],
              components: [row],
            });
          }
        } catch (err) {
          console.error('lookupRobloxUser error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat menghubungi API Roblox. Coba lagi beberapa saat lagi.',
          });
        }

        return;
      }

      if (customId === 'modal_redeem_key_month') {
        await interaction.deferReply({ ephemeral: true });

        const rawKey = interaction.fields
          .getTextInputValue('field_key_month')
          .trim();
        const key = rawKey.toUpperCase();

        if (!key) {
          await interaction.editReply({ content: 'Key tidak boleh kosong.' });
          return;
        }

        await redeemPaidKeyFlow(interaction, key, 'month');
        return;
      }

      if (customId === 'modal_redeem_key_life') {
        await interaction.deferReply({ ephemeral: true });

        const rawKey = interaction.fields
          .getTextInputValue('field_key_life')
          .trim();
        const key = rawKey.toUpperCase();

        if (!key) {
          await interaction.editReply({ content: 'Key tidak boleh kosong.' });
          return;
        }

        await redeemPaidKeyFlow(interaction, key, 'lifetime');
        return;
      }

      if (customId === 'modal_redeem_key_any') {
        await interaction.deferReply({ ephemeral: true });

        const rawKey = interaction.fields
          .getTextInputValue('field_key_any')
          .trim();
        const key = rawKey.toUpperCase();

        if (!key) {
          await interaction.editReply({ content: 'Key tidak boleh kosong.' });
          return;
        }

        await redeemPaidKeyFlow(interaction, key, 'any');
        return;
      }

      if (customId === 'modal_reset_hwid') {
        await interaction.deferReply({ ephemeral: true });

        const rawKey = interaction.fields
          .getTextInputValue('field_reset_hwid_key')
          .trim();
        const key = rawKey.toUpperCase();

        if (!key) {
          await interaction.editReply({
            content: 'Key tidak boleh kosong.',
          });
          return;
        }

        if (!RESET_HWID_API_URL) {
          await interaction.editReply({
            content:
              'Fitur Reset HWID belum dikonfigurasi. Minta admin mengisi `RESET_HWID_API_URL` di `.env` bot.',
          });
          return;
        }

        try {
          const result = await resetHwidOnAPI(key, interaction.user);

          let ok = true;
          let detail = '';
          if (result && typeof result === 'object') {
            if (typeof result.ok === 'boolean') ok = result.ok;
            detail =
              result.message ||
              result.reason ||
              result.error ||
              '';
          }

          if (ok) {
            let msg =
              `✅ Reset HWID berhasil untuk key \`${key}\`.\n` +
              'Silakan buka kembali ExHub Panel di Roblox dan login dari device baru kamu.';
            if (detail) {
              msg += `\n\nDetail: ${detail}`;
            }
            await interaction.editReply({ content: msg });

            if (interaction.guild) {
              const log = new EmbedBuilder()
                .setTitle('♻️ HWID Reset Success')
                .addFields(
                  {
                    name: 'Discord User',
                    value: `${interaction.user} (${interaction.user.id})`,
                  },
                  { name: 'Key', value: `\`${key}\`` }
                )
                .setTimestamp()
                .setColor(0x57f287);
              await logOrder(interaction.guild, log);
            }
          } else {
            let msg =
              '❌ Reset HWID gagal. Silakan cek kembali key kamu atau hubungi admin.';
            if (detail) {
              msg += `\n\nDetail: ${detail}`;
            }
            await interaction.editReply({ content: msg });

            if (interaction.guild) {
              const log = new EmbedBuilder()
                .setTitle('⚠️ HWID Reset Failed')
                .addFields(
                  {
                    name: 'Discord User',
                    value: `${interaction.user} (${interaction.user.id})`,
                  },
                  { name: 'Key', value: `\`${key}\`` },
                  ...(detail
                    ? [{ name: 'Detail', value: detail.slice(0, 1000) }]
                    : [])
                )
                .setTimestamp()
                .setColor(0xed4245);
              await logOrder(interaction.guild, log);
            }
          }
        } catch (err) {
          console.error('resetHwidOnAPI error:', err);
          const msg =
            'Terjadi kesalahan saat menghubungi API reset HWID. Coba lagi beberapa saat lagi atau hubungi admin.';
          await interaction.editReply({
            content: `${msg}\n\nDetail teknis: \`${String(
              err.message || err
            ).slice(0, 180)}\``,
          });

          if (interaction.guild) {
            const log = new EmbedBuilder()
              .setTitle('⚠️ HWID Reset Error')
              .addFields(
                {
                  name: 'Discord User',
                  value: `${interaction.user} (${interaction.user.id})`,
                },
                { name: 'Key', value: `\`${key}\`` },
                {
                  name: 'Error',
                  value: String(err.message || err).slice(0, 1000),
                }
              )
              .setTimestamp()
              .setColor(0xed4245);
            await logOrder(interaction.guild, log);
          }
        }

        return;
      }

      return;
    }
  } catch (err) {
    console.error('interactionCreate error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Terjadi error internal saat memproses perintah.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (_) {}
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName('sendticketpanel')
    .setDescription('Kirim panel store / ticket di channel ini'),
  new SlashCommandBuilder()
    .setName('sendcontrolpanel')
    .setDescription('Kirim control panel utama ExHub di channel ini'),
  new SlashCommandBuilder()
    .setName('setharga_sebulan')
    .setDescription('Ubah harga paket Key Sebulan')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga dalam Rupiah (misal: 15000)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setharga_lifetime')
    .setDescription('Ubah harga paket Key Lifetime')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga dalam Rupiah (misal: 25000)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setharga_indohangout')
    .setDescription('Ubah harga paket Indo Hangout Premium')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga dalam Rupiah (misal: 10000)')
        .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName('setharga_indohangout')
    .setDescription('Ubah harga paket Indo Hangout Premium')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga dalam Rupiah (misal: 10000)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('disablepricelifetime')
    .setDescription('Aktifkan / nonaktifkan paket Key Lifetime di dropdown ticket')
    .addBooleanOption((opt) =>
      opt
        .setName('disabled')
        .setDescription('true = sembunyikan, false = tampilkan')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('disableprice3month')
    .setDescription('Aktifkan / nonaktifkan paket Key 3 Bulan di dropdown ticket')
    .addBooleanOption((opt) =>
      opt
        .setName('disabled')
        .setDescription('true = sembunyikan, false = tampilkan')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('disableprice6month')
    .setDescription('Aktifkan / nonaktifkan paket Key 6 Bulan di dropdown ticket')
    .addBooleanOption((opt) =>
      opt
        .setName('disabled')
        .setDescription('true = sembunyikan, false = tampilkan')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('generatekeysebulan')
    .setDescription('Generate key sebulan untuk member')
    .addUserOption((opt) =>
      opt
        .setName('member')
        .setDescription(
          'Member yang akan menerima key (jika kosong, tampil di reply)'
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('generatekeylifetime')
    .setDescription('Generate key lifetime untuk member')
    .addUserOption((opt) =>
      opt
        .setName('member')
        .setDescription(
          'Member yang akan menerima key (jika kosong, tampil di reply)'
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('redeemkeysebulan')
    .setDescription('Redeem key sebulan (muncul modal input key)'),
  new SlashCommandBuilder()
    .setName('redeemkeylifetime')
    .setDescription('Redeem key lifetime (muncul modal input key)'),
  new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set channel untuk welcome message')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel tujuan welcome')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setleavechannel')
    .setDescription('Set channel untuk leave message')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel tujuan leave')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('changenamechannel')
    .setDescription('Ubah nama channel, contoh: #welcome → #✅️ ~ Verify')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel yang ingin diganti namanya')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nama channel baru, contoh: ✅️ ~ Verify')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('refreshserverstats')
    .setDescription(
      'Refresh nama channel SERVER STATS (All Members, Members, Bots, Boosts)'
    ),
  new SlashCommandBuilder()
    .setName('sendupdatesc')
    .setDescription('Kirim pengumuman NEW UPDATE SC untuk suatu script')
    .addStringOption((opt) =>
      opt
        .setName('script')
        .setDescription('Nama script, misal: SPEAR FISHING / GET FISH')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Status script')
        .setRequired(true)
        .addChoices(
          { name: '[🟢] WORKING / STABLE', value: 'WORKING' },
          { name: 'ONLINE', value: 'ONLINE' },
          { name: 'OFFLINE (NOT WORKING)', value: 'OFFLINE' },
          {
            name: '[🟡] OUTDATED (BISA DIPAKE)',
            value: 'OUTDATED (BISA DIPAKE)',
          },
          { name: '🛠️ NEED UPDATE', value: 'NEED UPDATE' },
          { name: '⏳ COMING SOON', value: 'COMING SOON' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('features')
        .setDescription(
          'Daftar fitur (pisah dengan koma / ; / newline). Contoh: Auto Farm; Auto Skill; ESP Fish'
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('changelogs')
        .setDescription(
          'Daftar change logs (pisah dengan koma / ; / newline). Contoh: Added Hide Nickname; Added Low Graphic'
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('nextupdate')
        .setDescription('Rencana next update (boleh "-" jika belum ada)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription(
          'Channel tujuan pengumuman (kosongkan = pakai UPDATE_CHANNEL_ID atau channel ini)'
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('sendreactionrole')
    .setDescription(
      'Kirim pesan reaction role (multi role, multi emoji, multi channel)'
    )
    .addStringOption((opt) =>
      opt
        .setName('config')
        .setDescription(
          'Daftar emoji & role (pisah baris / koma). Contoh: "🇮🇩 ; @MemberID , 🇺🇸 ; @MemberEN #Pesan"'
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('channels')
        .setDescription(
          'Channel (mention/ID, pisah spasi/koma). Kosongkan = channel ini.'
        )
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription(
          'Pesan yang dikirim sebelum daftar emoji (optional, override # di config)'
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('runtime')
    .setDescription('Lihat runtime & spesifikasi core VPS untuk bot ini'),
  new SlashCommandBuilder()
    .setName('mykey')
    .setDescription('Lihat semua paid key yang terikat ke akun Discord kamu'),
  new SlashCommandBuilder()
    .setName('checkmykey')
    .setDescription('Alias dari /mykey untuk cek semua paid key kamu'),
].map((c) => c.setDMPermission(false).toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    if (!DISCORD_TOKEN || !CLIENT_ID) {
      console.error(
        'DISCORD_TOKEN atau CLIENT_ID belum di-set. Cek .env di Railway / VPS.'
      );
      return;
    }

    console.log('DEBUG CLIENT_ID:', CLIENT_ID);
    console.log('DEBUG GUILD_ID:', process.env.GUILD_ID);
    console.log(
      'DEBUG TOKEN LENGTH:',
      DISCORD_TOKEN ? DISCORD_TOKEN.length : 'NO TOKEN'
    );

    console.log('⏳ Registering slash commands...');
    const guildId = process.env.GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
        body: commands,
      });
      console.log('✅ Slash commands registered (guild specific).');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
      console.log('✅ Slash commands registered (global).');
    }

    await client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error('Failed to start bot:', err);
  }
})();
