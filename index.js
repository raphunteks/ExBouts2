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
let priceKeyLifetime = Number(process.env.PRICE_KEY_LIFETIME || 25000);
let priceIndoHangout = Number(process.env.PRICE_INDO_HANGOUT || 10000);

// HARGA EMOTES BARU
let priceKey3Month = Number(process.env.PRICE_KEY_3MONTH || 30000);
let priceKey6Month = Number(process.env.PRICE_KEY_6MONTH || 50000);

// FLAG ENABLE/DISABLE DROPDOWN PAKET
let isLifetimeEnabled = true;
let isEmote3MonthEnabled = true;
let isEmote6MonthEnabled = true;

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
    console.error(`validatePaidKey (${mode}) error:', err`);
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
 */
async function sendTicketIntroMessage(channel, user) {
  const lines = [
    `Halo ${user}, terima kasih telah membuat ticket order VIP.`,
    '',
    '**Paket Tersedia**',
  ];

  // Key Sebulan selalu ada
  lines.push(
    `⚡ Key Sebulan – Rp ${formatRupiah(
      priceKeyMonth
    )} (Akses 1 Script • 30 hari)`
  );

  // Lifetime hanya jika enabled
  if (isLifetimeEnabled) {
    lines.push(
      `🔥 Key Lifetime – Rp ${formatRupiah(
        priceKeyLifetime
      )} (Akses 1 Script • 1 tahun)`
    );
  }

  // Emotes Key 3 Bulan (dropdown baru)
  if (isEmote3MonthEnabled) {
    lines.push(
      `🎭 Emotes Key 3 Bulan – Rp ${formatRupiah(
        priceKey3Month
      )} (Akses emote premium • 90 hari)`
    );
  }

  // Emotes Key 6 Bulan (dropdown baru)
  if (isEmote6MonthEnabled) {
    lines.push(
      `🎭 Emotes Key 6 Bulan – Rp ${formatRupiah(
        priceKey6Month
      )} (Akses emote premium • 180 hari)`
    );
  }

  // Indo Hangout tetap
  lines.push(
    `🇮🇩 Indo Hangout Premium – Rp ${formatRupiah(
      priceIndoHangout
    )} (1 Username • Permanent)`
  );

  lines.push(
    '',
    '**Langkah Selanjutnya**',
    '1. Pilih paket dari dropdown list menu di bawah.',
    '2. Ikuti instruksi yang muncul.',
    '3. Upload bukti bayar (screenshot QRIS) di channel ini.',
    '4. Tunggu konfirmasi admin ✅',
    '',
    '⚠️ Jika button tidak muncul, kirim pesan apa saja di channel ini untuk refresh.'
  );

  const desc = lines.join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✨ Ticket Order Paid Key ✨')
    .setDescription(desc)
    .setColor(0xfee75c);

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select_package')
    .setPlaceholder('📦 Silahkan pilih orderan Anda');

  const options = [];

  // Key Sebulan
  options.push({
    label: 'Key Sebulan',
    description: `Rp ${formatRupiah(
      priceKeyMonth
    )} • 2 Script Premium (30 hari)`,
    value: 'KEY_MONTH',
    emoji: '⚡',
  });

  // Key Lifetime jika enabled
  if (isLifetimeEnabled) {
    options.push({
      label: 'Key Lifetime',
      description: `Rp ${formatRupiah(
        priceKeyLifetime
      )} • 2 Script Premium (1 tahun)`,
      value: 'KEY_LIFE',
      emoji: '🔥',
    });
  }

  // Emotes Key 3 Bulan jika enabled
  if (isEmote3MonthEnabled) {
    options.push({
      label: 'Emotes Key 3 Bulan',
      description: `Rp ${formatRupiah(
        priceKey3Month
      )} • Akses emote premium (90 hari)`,
      value: 'EMOTE_3M',
      emoji: '🎭',
    });
  }

  // Emotes Key 6 Bulan jika enabled
  if (isEmote6MonthEnabled) {
    options.push({
      label: 'Emotes Key 6 Bulan',
      description: `Rp ${formatRupiah(
        priceKey6Month
      )} • Akses emote premium (180 hari)`,
      value: 'EMOTE_6M',
      emoji: '🎭',
    });
  }

  // Indo Hangout tetap selalu ada
  options.push({
    label: 'Indo Hangout Premium',
    description: `Rp ${formatRupiah(
      priceIndoHangout
    )} • 1 Username (Permanent)`,
    value: 'INDO_VIP',
    emoji: '🇮🇩',
  });

  select.addOptions(options);

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

      // TOGGLE ENABLE/DISABLE PAKET LIFETIME
      } else if (commandName === 'disablepricelifetime') {
        if (!(await ensureOwner())) return;
        isLifetimeEnabled = !isLifetimeEnabled;
        await interaction.reply({
          content: `Paket **Key Lifetime** sekarang: **${isLifetimeEnabled ? 'AKTIF (muncul di dropdown)' : 'NONAKTIF (disembunyikan dari dropdown)'}**.`,
          flags: MessageFlags.Ephemeral,
        });

      // TOGGLE ENABLE/DISABLE EMOTES 3 BULAN
      } else if (commandName === 'disableprice3month') {
        if (!(await ensureOwner())) return;
        isEmote3MonthEnabled = !isEmote3MonthEnabled;
        await interaction.reply({
          content: `Paket **Emotes Key 3 Bulan** sekarang: **${isEmote3MonthEnabled ? 'AKTIF (muncul di dropdown)' : 'NONAKTIF (disembunyikan dari dropdown)'}**.`,
          flags: MessageFlags.Ephemeral,
        });

      // TOGGLE ENABLE/DISABLE EMOTES 6 BULAN
      } else if (commandName === 'disableprice6month') {
        if (!(await ensureOwner())) return;
        isEmote6MonthEnabled = !isEmote6MonthEnabled;
        await interaction.reply({
          content: `Paket **Emotes Key 6 Bulan** sekarang: **${isEmote6MonthEnabled ? 'AKTIF (muncul di dropdown)' : 'NONAKTIF (disembunyikan dari dropdown)'}**.`,
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
          const activePaid =
          const info = await fetchUserKeyInfo(interaction.user);
          const activePaid = (info.paidKeys || []).filter(
            (k) => k.valid && !k.deleted && !k.expired
          );

          if (!activePaid.length) {
            await interaction.editReply({
              content:
                'Tidak ditemukan paid key aktif di akun kamu. Pastikan sudah redeem key terlebih dahulu.',
            });
            return;
          }

          if (member.roles.cache.has(role.id)) {
            await interaction.editReply({
              content: `Kamu sudah memiliki role premium ${role} di server ini.`,
            });
            return;
          }

          await member.roles.add(role);

          await interaction.editReply({
            content: `✅ Role premium ${role} berhasil diberikan. Terima kasih sudah mendukung ExHub!`,
          });
        } catch (err) {
          console.error('control_claim_role error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat memproses claim role. Coba lagi beberapa saat lagi atau hubungi admin.',
          });
        }

        return;
      }

      if (customId === 'control_get_stats') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const info = await fetchUserKeyInfo(interaction.user);
          const { stats } = info || {};

          const embed = new EmbedBuilder()
            .setTitle('📊 Your ExHub Stats')
            .setColor(0x5865f2);

          const lines = [];

          if (stats && stats.subscription) {
            lines.push(`**Subscription:** ${stats.subscription}`);
          }

          if (stats && typeof stats.totalExec === 'number') {
            lines.push(`**Total Executions:** ${stats.totalExec}`);
          }

          if (stats && stats.lastExecAtMs) {
            const ts = Math.floor(stats.lastExecAtMs / 1000);
            lines.push(`**Last Execution:** <t:${ts}:f> • <t:${ts}:R>`);
          }

          if (stats && typeof stats.totalClaimed === 'number') {
            lines.push(`**Total Daily Claims:** ${stats.totalClaimed}`);
          }

          if (stats && stats.lastClaimAtMs) {
            const ts = Math.floor(stats.lastClaimAtMs / 1000);
            lines.push(`**Last Daily Claim:** <t:${ts}:f> • <t:${ts}:R>`);
          }

          if (!lines.length) {
            lines.push(
              'Belum ada data statistik yang tercatat untuk akun kamu di API.'
            );
          }

          embed.setDescription(lines.join('\n'));

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('control_get_stats error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat mengambil statistik dari API. Coba lagi beberapa saat lagi.',
          });
        }

        return;
      }

      if (customId === 'store_create_ticket') {
        if (!interaction.guild) {
          await interaction.reply({
            content:
              'Perintah ini hanya dapat digunakan di dalam server (bukan DM).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const guild = interaction.guild;

          const existing = Array.from(ticketOwners.entries()).find(
            ([, uid]) => uid === interaction.user.id
          );
          if (existing) {
            const existingChannel = guild.channels.cache.get(existing[0]);
            if (existingChannel) {
              await interaction.editReply({
                content: `Kamu sudah punya ticket: ${existingChannel}. Gunakan ticket tersebut terlebih dahulu.`,
              });
              return;
            } else {
              ticketOwners.delete(existing[0]);
            }
          }

          const baseName = interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 8);
          const randomCode = crypto.randomBytes(2).toString('hex');
          const channelName = `ticket-${baseName || 'user'}-${randomCode}`;

          const everyoneRole = guild.roles.everyone;

          const permissionOverwrites = [
            {
              id: everyoneRole.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
              ],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles,
              ],
            },
          ];

          for (const ownerId of OWNER_IDS) {
            const ownerMember = guild.members.cache.get(ownerId);
            if (!ownerMember) continue;
            permissionOverwrites.push({
              id: ownerMember.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages,
              ],
            });
          }

          const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            topic: `Ticket order ExHub | OwnerID:${interaction.user.id}`,
            permissionOverwrites,
          };

          if (TICKET_CATEGORY_ID) {
            const cat = guild.channels.cache.get(TICKET_CATEGORY_ID);
            if (cat && cat.type === ChannelType.GuildCategory) {
              channelOptions.parent = cat.id;
            }
          }

          const ticketChannel = await guild.channels.create(channelOptions);

          ticketOwners.set(ticketChannel.id, interaction.user.id);

          await interaction.editReply({
            content: `✅ Ticket berhasil dibuat: ${ticketChannel}`,
          });

          await sendTicketPaymentMethodIntro(ticketChannel, interaction.user);
        } catch (err) {
          console.error('store_create_ticket error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat membuat ticket. Pastikan bot punya izin **Manage Channels**.',
          });
        }

        return;
      }

      if (
        customId === 'ticket_cancel' ||
        customId === 'ticket_confirm' ||
        customId === 'ticket_close'
      ) {
        if (!interaction.guild || !interaction.channel) {
          await interaction.reply({
            content: 'Aksi ticket hanya bisa digunakan di dalam server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const guild = interaction.guild;
        const channel = interaction.channel;
        const ownerId = getTicketOwnerId(channel);

        const isTicketOwner = ownerId === interaction.user.id;
        const isStaff =
          interaction.memberPermissions?.has(
            PermissionsBitField.Flags.ManageChannels
          ) || isOwner(interaction.user.id);

        if (!isTicketOwner && !isStaff) {
          await interaction.reply({
            content:
              'Kamu tidak punya izin untuk mengelola ticket ini. Hanya owner ticket atau staff yang bisa.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (customId === 'ticket_cancel') {
          ticketOrders.delete(channel.id);

          await interaction.reply({
            content: '❌ Order di ticket ini dibatalkan.',
            flags: MessageFlags.Ephemeral,
          });

          await channel.send({
            content: `Order di ticket ini telah dibatalkan oleh <@${interaction.user.id}>.`,
          });

          return;
        }

        if (customId === 'ticket_confirm') {
          const order = ticketOrders.get(channel.id);
          if (!order) {
            await interaction.reply({
              content:
                'Belum ada paket yang dipilih. Silakan pilih paket terlebih dahulu dari menu dropdown.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const userMention = ownerId ? `<@${ownerId}>` : 'user';
          const methodLabel =
            order.paymentMethod === 'BOOST' ? 'Server Booster' : 'QRIS / Rupiah';

          const descLines = [
            `**Order dikunci oleh:** <@${interaction.user.id}>`,
            `**Pemilik Ticket:** ${userMention}`,
            `**Metode Pembayaran:** ${methodLabel}`,
            `**Paket:** ${order.label || order.type}`,
          ];

          if (order.price) {
            descLines.push(`**Harga:** Rp ${formatRupiah(order.price)}`);
          }

          if (order.extraInfo) {
            descLines.push(order.extraInfo);
          }

          const embed = new EmbedBuilder()
            .setTitle('✅ Order Ticket Dikonfirmasi')
            .setDescription(descLines.join('\n'))
            .setColor(0x57f287)
            .setTimestamp(new Date());

          await interaction.reply({
            content: 'Order berhasil dikonfirmasi.',
            flags: MessageFlags.Ephemeral,
          });

          await channel.send({
            content: '<@&' + (PAID_ROLE_ID || OWNER_IDS[0] || '') + '>',
            embeds: [embed],
          });

          await logPaidOrder(guild, {
            content: `Order paid key dari channel ${channel} telah dikonfirmasi.`,
            embeds: [embed],
          });

          return;
        }

        if (customId === 'ticket_close') {
          await interaction.deferReply({ ephemeral: true });

          try {
            const newName = channel.name.startsWith('closed-')
              ? channel.name
              : `closed-${channel.name}`.slice(0, 100);

            await channel.setName(newName).catch(() => {});

            const ticketOwnerId = ownerId;
            if (ticketOwnerId) {
              await channel.permissionOverwrites.edit(ticketOwnerId, {
                ViewChannel: false,
                SendMessages: false,
              });
            }

            ticketOwners.delete(channel.id);
            ticketOrders.delete(channel.id);

            await interaction.editReply({
              content:
                'Ticket berhasil ditutup. Channel akan disembunyikan dari pemilik ticket.',
            });

            await channel.send({
              content: '🔒 Ticket ini telah ditutup. Terima kasih.',
            });
          } catch (err) {
            console.error('ticket_close error:', err);
            await interaction.editReply({
              content:
                'Gagal menutup ticket. Pastikan bot memiliki izin **Manage Channels** dan **Manage Roles**.',
            });
          }

          return;
        }
      }

      return;
    }

    // ====================== STRING SELECT MENUS ======================
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;
      const value = values && values[0];

      if (
        !customId ||
        !value ||
        !interaction.guild ||
        !interaction.channel
      ) {
        await interaction.reply({
          content: 'Interaksi tidak valid.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (customId === 'ticket_select_payment_method') {
        if (value === 'PAY_IDR') {
          await interaction.deferReply({ ephemeral: true });
          await sendTicketIntroMessage(interaction.channel, interaction.user);
          await interaction.editReply({
            content:
              'Metode pembayaran **Rupiah (QRIS)** dipilih. Silakan lanjutkan dengan memilih paket.',
          });

          ticketOrders.set(interaction.channel.id, {
            paymentMethod: 'IDR',
          });

          return;
        }

        if (value === 'PAY_BOOST') {
          await interaction.deferReply({ ephemeral: true });
          await sendTicketIntroMessage2(interaction.channel, interaction.user);
          await interaction.editReply({
            content:
              'Metode pembayaran **Server Booster** dipilih. Silakan lanjutkan dengan memilih paket booster.',
          });

          ticketOrders.set(interaction.channel.id, {
            paymentMethod: 'BOOST',
          });

          return;
        }
      }

      if (customId === 'ticket_select_package') {
        await interaction.deferReply({ ephemeral: true });

        const existing = ticketOrders.get(interaction.channel.id) || {};
        const method = existing.paymentMethod || 'IDR';

        let label = '';
        let price = 0;
        let type = value;

        if (value === 'KEY_MONTH') {
          label = 'Key Sebulan (30 hari • 2 Script Premium)';
          price = priceKeyMonth;
        } else if (value === 'KEY_LIFE') {
          label = 'Key Lifetime (1 tahun • 2 Script Premium)';
          price = priceKeyLifetime;
        } else if (value === 'EMOTE_3M') {
          label = 'Emotes Key 3 Bulan (90 hari)';
          price = priceKey3Month;
        } else if (value === 'EMOTE_6M') {
          label = 'Emotes Key 6 Bulan (180 hari)';
          price = priceKey6Month;
        } else if (value === 'INDO_VIP') {
          label = 'Indo Hangout Premium (1 Username • Permanent)';
          price = priceIndoHangout;
        }

        const summaryLines = [
          `**Metode Pembayaran:** ${method === 'BOOST' ? 'Server Booster' : 'Rupiah (QRIS)'}`,
          `**Paket:** ${label || type}`,
        ];

        if (price > 0) {
          summaryLines.push(`**Harga:** Rp ${formatRupiah(price)}`);
        }

        summaryLines.push(
          '',
          'Silakan lakukan pembayaran sesuai metode yang dipilih lalu upload bukti pembayaran (screenshot QRIS) di ticket ini.',
          'Setelah itu, tekan tombol **Confirm Order** agar staff memproses pesanan kamu.'
        );

        if (QRIS_IMAGE_URL && method === 'IDR') {
          const embed = new EmbedBuilder()
            .setTitle('📷 QRIS Pembayaran')
            .setDescription(summaryLines.join('\n'))
            .setColor(0xfee75c)
            .setImage(QRIS_IMAGE_URL);

          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply({
            content: summaryLines.join('\n'),
          });
        }

        ticketOrders.set(interaction.channel.id, {
          ...existing,
          type,
          label,
          price,
          createdAt: Date.now(),
        });

        return;
      }

      if (customId === 'ticket_select_boost_package') {
        await interaction.deferReply({ ephemeral: true });

        const existing = ticketOrders.get(interaction.channel.id) || {};
        const method = 'BOOST';

        let label = '';
        let extraInfo = '';
        let type = value;

        if (value === 'BOOST_1M') {
          label = 'Key 1 Month (30 days)';
          extraInfo =
            'Syarat: **3x Server Booster** aktif di server ini selama minimal 30 hari.';
        } else if (value === 'BOOST_3M') {
          label = 'Key 3 Months (90 days)';
          extraInfo =
            'Syarat: **5x Server Booster** aktif di server ini selama minimal 90 hari.';
        }

        const lines = [
          '**Server Booster Order Summary**',
          '',
          `**Paket:** ${label || type}`,
          extraInfo || '',
          '',
          'Silakan lakukan **Server Boost** sesuai syarat di atas.',
          'Setelah boost aktif, kirimkan screenshot bukti boosts di ticket ini.',
          'Jika sudah lengkap, tekan tombol **Confirm Order** agar staff memverifikasi dan mengirim key.',
        ];

        await interaction.editReply({
          content: lines.join('\n'),
        });

        ticketOrders.set(interaction.channel.id, {
          ...existing,
          paymentMethod: method,
          type,
          label,
          extraInfo,
          createdAt: Date.now(),
        });

        return;
      }

      return;
    }

    // ====================== MODALS ======================
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (customId === 'modal_redeem_key_month') {
        const key = interaction.fields
          .getTextInputValue('field_key_month')
          .trim();

        await interaction.deferReply({ ephemeral: true });
        await redeemPaidKeyFlow(interaction, key, 'month');
        return;
      }

      if (customId === 'modal_redeem_key_life') {
        const key = interaction.fields
          .getTextInputValue('field_key_life')
          .trim();

        await interaction.deferReply({ ephemeral: true });
        await redeemPaidKeyFlow(interaction, key, 'lifetime');
        return;
      }

      if (customId === 'modal_redeem_key_any') {
        const key = interaction.fields
          .getTextInputValue('field_key_any')
          .trim();

        await interaction.deferReply({ ephemeral: true });
        await redeemPaidKeyFlow(interaction, key, 'any');
        return;
      }

      if (customId === 'modal_reset_hwid') {
        const key = interaction.fields
          .getTextInputValue('field_reset_hwid_key')
          .trim();

        await interaction.deferReply({ ephemeral: true });

        try {
          const result = await resetHwidOnAPI(key, interaction.user);

          const successMsg =
            result && (result.message || result.status || result.ok)
              ? String(result.message || result.status || 'Reset HWID berhasil.')
              : 'Reset HWID berhasil diproses.';

          await interaction.editReply({
            content: `✅ ${successMsg}`,
          });
        } catch (err) {
          console.error('resetHwidOnAPI error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat memproses reset HWID. Pastikan key benar dan coba lagi.',
          });
        }

        return;
      }

      return;
    }
  } catch (err) {
    console.error('interactionCreate handler error:', err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'Terjadi kesalahan internal saat memproses interaksi.',
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        // ignore
      }
    }
  }
});

// ====================== SLASH COMMAND REGISTRATION ======================

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN atau CLIENT_ID belum diisi di .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('sendticketpanel')
    .setDescription('Kirim panel store ticket order paid key ke channel ini.'),
  new SlashCommandBuilder()
    .setName('sendcontrolpanel')
    .setDescription('Kirim ExHub Control Panel ke channel ini.'),
  new SlashCommandBuilder()
    .setName('setharga_sebulan')
    .setDescription('Set harga Key Sebulan (Rupiah).')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga baru dalam Rupiah')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setharga_lifetime')
    .setDescription('Set harga Key Lifetime (Rupiah).')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga baru dalam Rupiah')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setharga_indohangout')
    .setDescription('Set harga Indo Hangout Premium (Rupiah).')
    .addIntegerOption((opt) =>
      opt
        .setName('harga')
        .setDescription('Harga baru dalam Rupiah')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('disablepricelifetime')
    .setDescription(
      'Toggle tampil / sembunyikan paket Key Lifetime dari dropdown ticket.'
    ),
  new SlashCommandBuilder()
    .setName('disableprice3month')
    .setDescription(
      'Toggle tampil / sembunyikan paket Emotes Key 3 Bulan dari dropdown ticket.'
    ),
  new SlashCommandBuilder()
    .setName('disableprice6month')
    .setDescription(
      'Toggle tampil / sembunyikan paket Emotes Key 6 Bulan dari dropdown ticket.'
    ),
  new SlashCommandBuilder()
    .setName('generatekeysebulan')
    .setDescription('Generate Key Sebulan dan kirim ke DM atau reply.')
    .addUserOption((opt) =>
      opt
        .setName('member')
        .setDescription('Member yang akan dikirimi key (opsional)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('generatekeylifetime')
    .setDescription('Generate Key Lifetime dan kirim ke DM atau reply.')
    .addUserOption((opt) =>
      opt
        .setName('member')
        .setDescription('Member yang akan dikirimi key (opsional)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('redeemkeysebulan')
    .setDescription('Redeem Key Sebulan melalui modal input.'),
  new SlashCommandBuilder()
    .setName('redeemkeylifetime')
    .setDescription('Redeem Key Lifetime melalui modal input.'),
  new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set channel welcome.')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel untuk welcome message')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setleavechannel')
    .setDescription('Set channel leave.')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel untuk leave message')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('changenamechannel')
    .setDescription('Ubah nama sebuah channel.')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel yang akan di-rename')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nama baru channel')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('refreshserverstats')
    .setDescription('Refresh semua channel server stats.'),
  new SlashCommandBuilder()
    .setName('sendreactionrole')
    .setDescription('Kirim pesan Reaction Role secara dinamis.')
    .addStringOption((opt) =>
      opt
        .setName('config')
        .setDescription(
          'Config emoji;role. Contoh: 🇮🇩 ; @MemberID , 🇺🇸 ; @MemberEN #teks'
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('channels')
        .setDescription(
          'Daftar channel (mention / ID) dipisah koma. Kosongkan = channel ini.'
        )
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('Teks pesan di atas embed (opsional).')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('sendupdatesc')
    .setDescription('Kirim pengumuman NEW UPDATED script.')
    .addStringOption((opt) =>
      opt
        .setName('script')
        .setDescription('Nama script')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Status (WORKING / OUTDATED / NOT WORKING / dst.)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('features')
        .setDescription('Daftar fitur (pisah baris / koma).')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('changelogs')
        .setDescription('Daftar change logs (pisah baris / koma).')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('nextupdate')
        .setDescription('Info rencana next update (opsional).')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription(
          'Channel tujuan pengumuman. Kosongkan = channel ini / .env UPDATE_CHANNEL_ID.'
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('runtime')
    .setDescription('Tampilkan info runtime bot dan spesifikasi VPS.'),
  new SlashCommandBuilder()
    .setName('mykey')
    .setDescription('Lihat semua paid key yang terikat ke akun Discord kamu.'),
  new SlashCommandBuilder()
    .setName('checkmykey')
    .setDescription('Alias dari /mykey untuk cek key akun kamu.'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered (global).');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

// Jalankan registrasi command lalu login bot
(async () => {
  await registerCommands();

  try {
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error('Failed to login to Discord:', err);
  }
})();
