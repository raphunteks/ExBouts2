// index.js
// =====================================================
//  ExHub Store / Ticket Bot (single file, Railway ready)
// =====================================================

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
} = require('discord.js');

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const crypto = require('crypto');
const os = require('os'); // untuk /runtime spesifikasi VPS
const http = require('http'); // HTTP server untuk integrasi admin dashboard

// ---------- ENV & CONFIG ---------------------------------------

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Waktu start bot (dipakai /runtime)
const BOT_START_TIME = Date.now();

// OWNER_IDS bisa dari OWNER_IDS atau OWNER_ID (comma / spasi dipisah)
const RAW_OWNER_IDS =
  process.env.OWNER_IDS ||
  process.env.OWNER_ID ||
  '';

const OWNER_IDS = RAW_OWNER_IDS.split(/[,\s]+/).filter(Boolean);

// kategori untuk ticket (opsional, bisa null)
const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID ||
  process.env.CATTEGORY_TICKETCHANNEL_ID ||
  null;

// channel log order (opsional)
const CHANNEL_LOGORDER_ID = process.env.CHANNEL_LOGORDER_ID || null;

// welcome channel (bisa juga diubah via /setwelcomechannel)
let welcomeChannelId = process.env.WELCOME_CHANNEL_ID || null;

// role premium untuk Claim Role
const PAID_ROLE_ID = process.env.PAID_ROLE_ID || null;
// channel order-paid untuk pesan error Claim Role
const ORDER_PAID_CHANNEL_ID = process.env.ORDER_PAID_CHANNEL_ID || null;

// URL dasar validasi key (default ke API kamu)
const PAIDKEY_VALIDATE_BASE =
  process.env.PAIDKEY_VALIDATE_BASE ||
  'https://exc-webs.vercel.app/api/paidkey/isValidate';

// endpoint untuk create/simpan key di API
const PAIDKEY_CREATE_URL =
  process.env.PAIDKEY_CREATE_URL ||
  'https://exc-webs.vercel.app/api/paidkey/createOrUpdate';

// endpoint untuk ambil semua key + stats milik user (paid + free)
const EXHUB_USERINFO_URL =
  process.env.EXHUB_USERINFO_URL ||
  'https://exc-webs.vercel.app/api/paidfree/user-info';

// endpoint script & dashboard (opsional, untuk tombol panel kontrol)
const EXHUB_SCRIPT_URL = process.env.EXHUB_SCRIPT_URL || null;
const EXHUB_DASHBOARD_URL = process.env.EXHUB_DASHBOARD_URL || null;

// background untuk welcome (gambar 700x250 / HD yang kamu host)
const WELCOME_BG_URL = process.env.WELCOME_BG_URL || null;
// background khusus kartu welcome (kalau tidak di-set, fallback ke WELCOME_BG_URL)
const WELCOME_CARD_BG_URL =
  process.env.WELCOME_CARD_BG_URL || WELCOME_BG_URL || null;

// QRIS image URL (gambar PNG/JPG QRIS kamu)
const QRIS_IMAGE_URL = process.env.QRIS_IMAGE_URL || null;

// role yang akan di-mention untuk NEW UPDATE SC + channel default
const EVERYONE_ROLE_ID =
  process.env.EVERYONE_ROLE_ID || '1462774806079340574';
const UPDATE_CHANNEL_ID = process.env.UPDATE_CHANNEL_ID || null;
// Secret optional untuk API HTTP admin (jika diisi, wajib dikirim dari serverv2.js)
const ADMIN_UPDATE_SECRET = process.env.ADMIN_UPDATE_SECRET || null;

// ---------- SERVER STATS CONFIG --------------------------------
// Kategori + 4 channel untuk panel "📊 SERVER STATS 📊"
const SERVER_STATS_CATEGORY_ID = process.env.SERVER_STATS_CATEGORY_ID || null;
const SERVER_STATS_ALL_ID = process.env.SERVER_STATS_ALL_ID || null;
const SERVER_STATS_MEMBERS_ID = process.env.SERVER_STATS_MEMBERS_ID || null;
const SERVER_STATS_BOTS_ID = process.env.SERVER_STATS_BOTS_ID || null;
const SERVER_STATS_BOOSTS_ID = process.env.SERVER_STATS_BOOSTS_ID || null;

// harga default (bisa diubah pakai slash command)
let priceKeyMonth = Number(process.env.PRICE_KEY_MONTH || 15000);
let priceKeyLifetime = Number(process.env.PRICE_KEY_LIFETIME || 25000);
let priceIndoHangout = Number(process.env.PRICE_INDO_HANGOUT || 10000);

// ticketOwners: channelId -> userId
const ticketOwners = new Map();

// reaction role: messageId -> array { emoji, roleId }
const reactionRoles = new Map();

// ---------- HELPER UTILS ---------------------------------------

// sekarang support banyak OWNER_ID
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

// Format detik -> HH:MM:SS (untuk /runtime)
function formatSecondsToHMS(sec) {
  const s = sec % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Pesan runtime dipakai /runtime
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

// Pecah string jadi list (support newline, ;, atau , sebagai pemisah)
function splitList(text) {
  if (!text) return [];
  return String(text)
    .split(/[\n;,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Format sekarang ke "Today DD-MM-YYYY HH:MM WIB"
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

// Mapping STATUS -> label + warna embed + emoji header utama
function mapStatusLabelAndColor(rawStatus) {
  const s = String(rawStatus || '').trim();

  if (!s) {
    return {
      label: '[🟢] WORKING / STABLE',
      color: 0x57f287, // hijau
      headerEmoji: ':green_circle:',
    };
  }

  const upper = s.toUpperCase();

  // WORKING / STABLE / ONLINE
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

  // OUTDATED (BISA DIPAKE)
  if (upper.startsWith('OUTDATED')) {
    return {
      label: '[🟡] OUTDATED (BISA DIPAKE)',
      color: 0xfee75c,
      headerEmoji: ':yellow_circle:',
    };
  }

  // NOT WORKING / OFFLINE
  if (upper.includes('NOT WORKING') || upper === 'OFFLINE') {
    return {
      label: '❌ NOT WORKING',
      color: 0xed4245,
      headerEmoji: ':red_circle:',
    };
  }

  // NEED UPDATE
  if (upper.includes('NEED UPDATE')) {
    return {
      label: '🛠️ NEED UPDATE',
      color: 0xf39c12,
      headerEmoji: ':wrench:',
    };
  }

  // COMING SOON
  if (upper.includes('COMING SOON')) {
    return {
      label: '⏳ COMING SOON',
      color: 0x2b2d31,
      headerEmoji: ':hourglass_flowing_sand:',
    };
  }

  // Default: pakai apa adanya, warna netral
  return {
    label: s,
    color: 0x2b2d31,
    headerEmoji: ':white_small_square:',
  };
}

/**
 * Build payload pesan NEW UPDATE SC (format pakai blok kode + header gaya manual)
 */
function buildScriptUpdatePayload(options, guild, clientInstance) {
  const scriptName = options.scriptName || options.script || 'UNKNOWN';

  // Status mentah dari slash command / admin form
  const rawStatus = options.status || 'WORKING';

  // Konversi ke label + warna standar + emoji header
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

  // Helper: prefix default emoji hanya jika baris belum punya prefix sendiri
  const formatLines = (list, defaultPrefix) => {
    if (!list || !list.length) return ['-'];
    const out = [];
    for (const raw of list) {
      const line = String(raw).trim();
      if (!line) continue;

      // Jika user sudah kasih prefix sendiri (emoji / [..] / bullet), jangan ditambah lagi
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

  // ---------- FIX: resolve mention supaya tidak jadi "@@everyone" ----------
  // Default: gunakan ping @everyone
  let mention = '@everyone';

  // Jika disediakan EVERYONE_ROLE_ID dan role-nya valid serta NAMANYA tidak diawali '@',
  // gunakan ping role (<@&ROLE_ID>). Kalau namanya diawali '@' (mis: "@everyone"),
  // kita tetap fallback ke @everyone supaya tidak jadi "@@everyone".
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
  // ------------------------------------------------------------------------

  const descriptionParts = [];

  // Header utama
  const headerStatusEmoji = headerEmoji || ':green_circle:';
  descriptionParts.push(`**【${headerStatusEmoji} 】NEW UPDATED**`);

  // Block SCRIPT + STATUS
  descriptionParts.push('```');
  descriptionParts.push(`[SCRIPT]: ${scriptName}`);
  descriptionParts.push(`[STATUS]: ${statusLabel}`);
  descriptionParts.push('```');

  // FEATURES
  descriptionParts.push('');
  descriptionParts.push('**【:information_source:】 FEATURES**');
  descriptionParts.push('```');
  descriptionParts.push(...featureLines);
  descriptionParts.push('```');

  // CHANGE LOGS
  descriptionParts.push('');
  descriptionParts.push('**【:arrow_up_down: 】 CHANGE LOGS**');
  descriptionParts.push('```');
  descriptionParts.push(...changelogLines);
  descriptionParts.push('```');

  // NEXT UPDATE
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

// Normalisasi tipe key yang tersimpan di API
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

  // kalau tipe lain / custom, kembalikan apa adanya (lowercase)
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

// Tentukan pemilik key (Discord ID) untuk generate key
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

// Call API untuk cek key individual (paid key endpoint)
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

/**
 * Call API untuk create/update key di server ExHub
 */
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

  // Bind pemilik key (Discord ID) jika ada
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

// helper konversi ke ms (aman untuk number/string/null)
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

/**
 * Ambil semua key (paid + free) dan stats milik user dari /api/paidfree/user-info
 * Return: { paidKeys, freeKeys, allKeys, raw, stats }
 * - paidKeys/freeKeys/allKeys: array objek normalized:
 *   { token, type, provider, createdAtMs, expiresAfterMs, deleted, valid, expired, status, ownerDiscordId }
 * - stats: { totalExec, lastExecAtMs, executorName, subscription, totalClaimed, lastClaimAtMs }
 */
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

    // Deduplicate berdasarkan token
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
        (k.info && k.info.ownerDiscordId) ||
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

    // ----- Stats -----
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

// wrapper lama untuk /mykey (paid only)
async function fetchUserPaidKeys(discordUser) {
  const info = await fetchUserKeyInfo(discordUser);
  return info.paidKeys;
}

// lookup username Roblox -> { id, name, displayName }
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


// ---------- WELCOME CARD HELPER (Canvas) -----------------------

/**
 * Generate Buffer PNG kartu welcome (avatar + background + teks)
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<Buffer>}
 */
async function generateWelcomeCard(member) {
  const width = 1262;
  const height = 576;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
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

  // Avatar lingkaran
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

  // Border avatar
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2, true);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2196f3';
  ctx.stroke();

  // Teks "WELCOME"
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

  // Username
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

  // reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const buffer = await canvas.encode('png');
  return buffer;
}

// ---------- SERVER STATS HELPER --------------------------------

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

// ---------- DISCORD CLIENT -------------------------------------

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

// Welcome message + refresh stats (dengan kartu Canvas)
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

// Reaction role (multi)
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

// ---------- PANEL & TICKET HELPERS -----------------------------

async function sendStorePanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 EXHUB STORE - Premium Scripts')
    .setDescription(
      'Halo! Selamat datang di **EXHUB STORE** 👋\n\n' +
        'Kamu lagi cari script Roblox premium? Kamu datang ke tempat yang tepat!\n\n' +
        '✨ Script oke\n' +
        '💰 Harga bersahabat di kantong\n' +
        '⚡ Respon cepat dari admin\n\n' +
        'Klik tombol **📩 Buat Ticket** di bawah untuk mulai order ya!\n' +
        'Kami siap bantu kamu 24/7 🙂'
    )
    .setColor(0x2b2d31);

  const btn = new ButtonBuilder()
    .setCustomId('store_create_ticket')
    .setEmoji('📩')
    .setLabel('Buat Ticket')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);

  await channel.send({ embeds: [embed], components: [row] });
}

// Panel kontrol ala Sixsense (Redeem Key, Get Script, dll.)
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

async function sendTicketIntroMessage(channel, user) {
  const desc = [
    `Halo ${user}, terima kasih telah membuat ticket order VIP.`,
    '',
    '**Paket Tersedia**',
    `⚡ Key Sebulan – Rp ${formatRupiah(
      priceKeyMonth
    )} (Akses 5 Script • 30 hari)`,
    `🔥 Key Lifetime – Rp ${formatRupiah(
      priceKeyLifetime
    )} (Akses 5 Script • 1 tahun)`,
    `🇮🇩 Indo Hangout Premium – Rp ${formatRupiah(
      priceIndoHangout
    )} (1 Username • Permanent)`,
    '',
    '**Langkah Selanjutnya**',
    '1. Pilih paket dari dropdown menu di bawah.',
    '2. Ikuti instruksi yang muncul.',
    '3. Upload bukti bayar (screenshot QRIS) di channel ini.',
    '4. Tunggu konfirmasi admin ✅',
    '',
    '⚠️ Jika button tidak muncul, kirim pesan apa saja di channel ini untuk refresh.',
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✨ Ticket VIP Order')
    .setDescription(desc)
    .setColor(0xfee75c);

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_select_package')
    .setPlaceholder('📦 Pilih paket yang Anda inginkan...')
    .addOptions(
      {
        label: 'Key Sebulan',
        description: `Rp ${formatRupiah(
          priceKeyMonth
        )} • 5 Script Premium (30 hari)`,
        value: 'KEY_MONTH',
        emoji: '⚡',
      },
      {
        label: 'Key Lifetime',
        description: `Rp ${formatRupiah(
          priceKeyLifetime
        )} • 5 Script Premium (1 tahun)`,
        value: 'KEY_LIFE',
        emoji: '🔥',
      },
      {
        label: 'Indo Hangout Premium',
        description: `Rp ${formatRupiah(
          priceIndoHangout
        )} • 1 Username (Permanent)`,
        value: 'INDO_VIP',
        emoji: '🇮🇩',
      }
    );

  const rowSelect = new ActionRowBuilder().addComponents(select);

  const btnCancel = new ButtonBuilder()
    .setCustomId('ticket_cancel')
    .setLabel('Cancel Order')
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  const btnClose = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const rowButtons = new ActionRowBuilder().addComponents(btnCancel, btnClose);

  await channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [rowSelect, rowButtons],
  });
}

// ---------- INTERACTION HANDLER --------------------------------

client.on('interactionCreate', async (interaction) => {
  try {
    // ===================== SLASH COMMAND =======================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      const ensureOwner = async () => {
        if (!isOwner(interaction.user.id)) {
          await interaction.reply({
            content: 'Perintah ini hanya bisa digunakan oleh OWNER bot.',
            ephemeral: true,
          });
          return false;
        }
        return true;
      };

      // /sendticketpanel
      if (commandName === 'sendticketpanel') {
        if (!(await ensureOwner())) return;
        await sendStorePanel(interaction.channel);
        await interaction.reply({
          content: 'Panel ticket store sudah dikirim di channel ini.',
          ephemeral: true,
        });
      }

      // /sendcontrolpanel
      else if (commandName === 'sendcontrolpanel') {
        if (!(await ensureOwner())) return;
        await sendControlPanel(interaction.channel, interaction.guild);
        await interaction.reply({
          content: 'Control panel utama sudah dikirim di channel ini.',
          ephemeral: true,
        });
      }

      // /setharga_sebulan
      else if (commandName === 'setharga_sebulan') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceKeyMonth = harga;
        await interaction.reply({
          content: `Harga **Key Sebulan** di-set ke Rp ${formatRupiah(harga)}.`,
          ephemeral: true,
        });
      }

      // /setharga_lifetime
      else if (commandName === 'setharga_lifetime') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceKeyLifetime = harga;
        await interaction.reply({
          content: `Harga **Key Lifetime** di-set ke Rp ${formatRupiah(
            harga
          )}.`,
          ephemeral: true,
        });
      }

      // /setharga_indohangout
      else if (commandName === 'setharga_indohangout') {
        if (!(await ensureOwner())) return;
        const harga = interaction.options.getInteger('harga', true);
        priceIndoHangout = harga;
        await interaction.reply({
          content: `Harga **Indo Hangout Premium** di-set ke Rp ${formatRupiah(
            harga
          )}.`,
          ephemeral: true,
        });
      }

      // /generatekeysebulan
      else if (commandName === 'generatekeysebulan') {
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
            ephemeral: true,
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
          await interaction.reply({ content: msg, ephemeral: true });
        }
      }

      // /generatekeylifetime
      else if (commandName === 'generatekeylifetime') {
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
            ephemeral: true,
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
          await interaction.reply({ content: msg, ephemeral: true });
        }
      }

      // /redeemkeysebulan
      else if (commandName === 'redeemkeysebulan') {
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
      }

      // /redeemkeylifetime
      else if (commandName === 'redeemkeylifetime') {
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
      }

      // /setwelcomechannel
      else if (commandName === 'setwelcomechannel') {
        if (!(await ensureOwner())) return;
        const ch = interaction.options.getChannel('channel', true);
        welcomeChannelId = ch.id;
        await interaction.reply({
          content: `Welcome channel di-set ke ${ch}.`,
          ephemeral: true,
        });
      }

      // /refreshserverstats
      else if (commandName === 'refreshserverstats') {
        if (!(await ensureOwner())) return;
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya bisa digunakan di dalam server.',
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        await updateServerStats(interaction.guild);
        await interaction.editReply({
          content:
            'SERVER STATS berhasil di-refresh. Jika nama channel belum berubah, cek kembali ID channel di `.env`.',
        });
      }

      // /sendreactionrole
      else if (commandName === 'sendreactionrole') {
        if (!(await ensureOwner())) return;

        const rawConfigText = interaction.options.getString('config', true);
        const channelsText = interaction.options.getString('channels', false);

        // default content
        let contentText =
          interaction.options.getString('content', false) ||
          'React dengan emoji berikut untuk mendapatkan role:';

        // Support inline content pakai "#"
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
            ephemeral: true,
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
            ephemeral: true,
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
              ephemeral: true,
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

          reactionRoles.set(
            msg.id,
            parsed.map((p) => ({ emoji: p.emoji, roleId: p.roleId }))
          );
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
      }

      // /sendupdatesc
      else if (commandName === 'sendupdatesc') {
        if (!(await ensureOwner())) return;

        if (!interaction.guild) {
          await interaction.reply({
            content:
              'Perintah ini hanya bisa digunakan di dalam server (bukan DM).',
            ephemeral: true,
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

        // 1) jika user pilih channel
        if (
          targetChannelOpt &&
          (targetChannelOpt.type === ChannelType.GuildText ||
            targetChannelOpt.type === ChannelType.GuildAnnouncement)
        ) {
          targetChannel = targetChannelOpt;
        }
        // 2) kalau ada UPDATE_CHANNEL_ID di env
        else if (UPDATE_CHANNEL_ID) {
          const ch = interaction.guild.channels.cache.get(UPDATE_CHANNEL_ID);
          if (
            ch &&
            (ch.type === ChannelType.GuildText ||
              ch.type === ChannelType.GuildAnnouncement)
          ) {
            targetChannel = ch;
          }
        }
        // 3) fallback: channel sekarang
        if (!targetChannel) {
          targetChannel = interaction.channel;
        }

        if (!targetChannel || typeof targetChannel.send !== 'function') {
          await interaction.reply({
            content:
              'Channel tujuan tidak valid untuk mengirim pesan (bukan text/announcement channel).',
            ephemeral: true,
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
          ephemeral: true,
        });
      }

      // /runtime
      else if (commandName === 'runtime') {
        const msg = buildRuntimeMessage(client);
        await interaction.reply({ content: msg, ephemeral: true });
      }

      // /mykey dan /checkmykey (paid only)
      else if (commandName === 'mykey' || commandName === 'checkmykey') {
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

    // ===================== BUTTONS ==============================
    if (interaction.isButton()) {
      const { customId } = interaction;

      // ----- BUTTONS: CONTROL PANEL -----

      // Redeem Key -> modal input (auto detect month / lifetime)
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

      // Get Script -> kirim Desktop + Mobile (Tap to Copy)
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

        await interaction.reply({ content: msg, ephemeral: true });
        return;
      }

      // Check Key -> langsung panggil API dan kirim list paid+free
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
                lines.push(`**Expired:** <t:${expireTs}:f> • <t:${expireTs}:R>`);
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
            for (let i = 0; i < maxFree; i++) {
              const k = freeKeys[i];
              const createdTs = k.createdAtMs
                ? Math.floor(k.createdAtMs / 1000)
                : null;
              const expireTs = k.expiresAfterMs
                ? Math.floor(k.expiresAfterMs / 1000)
                : null;

              let providerLabel = k.provider || 'unknown';
              if (
                providerLabel.includes('work.ink') ||
                providerLabel === 'work.ink' ||
                providerLabel === 'workink'
              ) {
                providerLabel = 'Work.ink';
              } else if (providerLabel.includes('linkvertise')) {
                providerLabel = 'Linkvertise';
              }

              const lines = [];
              lines.push(`**Key:** \`${k.token}\``);
              lines.push(`**Provider:** ${providerLabel}`);
              if (createdTs) {
                lines.push(`**Claimed:** <t:${createdTs}:f>`);
              }
              if (expireTs) {
                lines.push(`**Expired:** <t:${expireTs}:f> • <t:${expireTs}:R>`);
              }
              lines.push(`**Status:** ${k.status}`);

              embed.addFields({
                name: `Free Key #${i + 1}`,
                value: lines.join('\n'),
                inline: false,
              });
            }
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
        await interaction.reply({
          content:
            'Reset HWID saat ini masih dilakukan secara manual lewat ticket.\n' +
            'Buka ticket, sertakan username Roblox dan bukti pembelian, lalu minta admin untuk reset HWID.\n' +
            'Jika nanti ada API reset HWID, tombol ini bisa dihubungkan langsung ke sistem tersebut.',
          ephemeral: true,
        });
        return;
      }

      // Claim Role -> cek paid key aktif dulu
      if (customId === 'control_claim_role') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya dapat digunakan di dalam server.',
            ephemeral: true,
          });
          return;
        }

        if (!PAID_ROLE_ID) {
          await interaction.reply({
            content:
              'PAID_ROLE_ID belum dikonfigurasi di .env. Minta admin untuk mengisi ID role premium.',
            ephemeral: true,
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

      // Get Stats -> ringkasan Total Keys, Paid/Free, Execute, Executor, dll
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

      // ----- BUTTONS: TICKET / ROBLOX FLOW -----

      // create ticket
      if (customId === 'store_create_ticket') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'Perintah ini hanya dapat digunakan di server.',
            ephemeral: true,
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

        await sendTicketIntroMessage(channel, interaction.user);

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

      // cancel order
      if (customId === 'ticket_cancel') {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content: 'Hanya pembuat ticket yang bisa membatalkan order ini.',
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: 'Ticket akan dihapus dalam 3 detik...',
          ephemeral: true,
        });

        setTimeout(() => {
          interaction.channel
            .delete('Ticket dibatalkan oleh user')
            .catch(() => {});
        }, 3000);
        return;
      }

      // close ticket
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
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: 'Ticket akan ditutup (channel dihapus) dalam 3 detik...',
          ephemeral: true,
        });

        setTimeout(() => {
          interaction.channel
            .delete('Ticket closed by staff')
            .catch(() => {});
        }, 3000);
        return;
      }

      // tombol "Input Username Lagi"
      if (customId === 'roblox_reinput' || customId === 'roblox_wrong') {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat menginput ulang username Roblox.',
            ephemeral: true,
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

      // tombol "Ya, Benar!" (konfirmasi username)
      if (customId.startsWith('roblox_confirm_')) {
        const ownerId = getTicketOwnerId(interaction.channel);
        if (
          interaction.user.id !== ownerId &&
          !isOwner(interaction.user.id)
        ) {
          await interaction.reply({
            content:
              'Hanya pembuat ticket yang dapat mengkonfirmasi username ini.',
            ephemeral: true,
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

    // ===================== SELECT MENU ==========================
    if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;
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
            ephemeral: true,
          });
          return;
        }

        if (value === 'KEY_MONTH') {
          const harga = priceKeyMonth;
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
        } else if (value === 'KEY_LIFE') {
          const harga = priceKeyLifetime;
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
        } else if (value === 'INDO_VIP') {
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

      return;
    }

    // ===================== MODAL SUBMIT =========================
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      // modal input username Roblox
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

      // modal redeem key sebulan
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

          if (keyType !== 'month') {
            await interaction.editReply({
              content:
                '❌ Key ini **bukan** tipe **Key Sebulan**.\n' +
                'Jika ini key lifetime, gunakan perintah `/redeemkeylifetime`.\n' +
                'Jika merasa ada kesalahan, silakan hubungi admin.',
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

          try {
            await createPaidKeyOnAPI(key, keyType, null, {
              valid: true,
              deleted: false,
              createdAt: info.createdAt,
              expiresAfter: info.expiresAfter,
              byIp: 'discord-bot-redeem-month',
              ownerDiscordId,
            });
          } catch (err) {
            console.error(
              'createPaidKeyOnAPI (redeem month) error:',
              err
            );
            await interaction.editReply({
              content:
                'Key ditemukan, tapi gagal mengupdate status di API. Coba lagi beberapa saat lagi.',
            });
            return;
          }

          await interaction.editReply({
            content:
              `✅ Key sebulan berhasil digunakan!\n` +
              `Key: \`${key}\`\n` +
              'Terima kasih sudah menggunakan ExHub.',
          });
        } catch (err) {
          console.error('validatePaidKey (month) error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat menghubungi API validasi key. Coba lagi beberapa saat lagi.',
          });
        }

        return;
      }

      // modal redeem key lifetime
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

          if (keyType !== 'lifetime') {
            await interaction.editReply({
              content:
                '❌ Key ini **bukan** tipe **Key Lifetime**.\n' +
                'Jika ini key sebulan, gunakan perintah `/redeemkeysebulan`.\n' +
                'Jika merasa ada kesalahan, silakan hubungi admin.',
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

          try {
            await createPaidKeyOnAPI(key, keyType, null, {
              valid: true,
              deleted: false,
              createdAt: info.createdAt,
              expiresAfter: info.expiresAfter,
              byIp: 'discord-bot-redeem-lifetime',
              ownerDiscordId,
            });
          } catch (err) {
            console.error(
              'createPaidKeyOnAPI (redeem lifetime) error:',
              err
            );
            await interaction.editReply({
              content:
                'Key ditemukan, tapi gagal mengupdate status di API. Coba lagi beberapa saat lagi.',
            });
            return;
          }

          await interaction.editReply({
            content:
              `✅ Key lifetime berhasil di redeem, silahkan digunakan!\n` +
              `Key: \`${key}\`\n` +
              'Terima kasih sudah menggunakan ExHub.',
          });
        } catch (err) {
          console.error('validatePaidKey (life) error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat menghubungi API validasi key. Coba lagi beberapa saat lagi.',
          });
        }

        return;
      }

      // modal redeem key via tombol panel (auto detect type)
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

          if (keyType !== 'month' && keyType !== 'lifetime') {
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

          try {
            await createPaidKeyOnAPI(key, keyType, null, {
              valid: true,
              deleted: false,
              createdAt: info.createdAt,
              expiresAfter: info.expiresAfter,
              byIp: 'discord-bot-redeem-any',
              ownerDiscordId,
            });
          } catch (err) {
            console.error(
              'createPaidKeyOnAPI (redeem any) error:',
              err
            );
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
          console.error('validatePaidKey (any) error:', err);
          await interaction.editReply({
            content:
              'Terjadi kesalahan saat menghubungi API validasi key. Coba lagi beberapa saat lagi.',
          });
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
          ephemeral: true,
        });
      }
    } catch (_) {}
  }
});

// ---------- REGISTER SLASH COMMANDS & LOGIN -------------------

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

// ---------- SIMPLE HTTP SERVER UNTUK ADMIN DASHBOARD (opsional) ----------
// Kirim POST ke /api/new-update-sc dengan body JSON:
// {
//   "secret": "ADMIN_UPDATE_SECRET (optional)",
//   "scriptName": "SPEAR FISHING",
//   "status": "WORKING",
//   "features": "Feature 1; Feature 2; Feature 3",
//   "changeLogs": "Change 1; Change 2",
//   "nextUpdate": "-",
//   "channelId": "ID_CHANNEL_TUJUAN (optional, fallback ke UPDATE_CHANNEL_ID)"
// }
const HTTP_PORT =
  process.env.BOT_HTTP_PORT ||
  process.env.HTTP_PORT ||
  process.env.PORT ||
  null;

if (HTTP_PORT) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/new-update-sc') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) {
          req.socket.destroy();
        }
      });
      req.on('end', async () => {
        try {
          const data = body ? JSON.parse(body) : {};

          if (ADMIN_UPDATE_SECRET && data.secret !== ADMIN_UPDATE_SECRET) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({ ok: false, error: 'Forbidden (bad secret)' })
            );
            return;
          }

          const scriptName = data.scriptName || data.script || 'UNKNOWN';
          const status = (data.status || 'WORKING').toString();
          const features = data.features || '';
          const changeLogs = data.changeLogs || data.changelogs || '';
          const nextUpdate = data.nextUpdate || '-';
          const channelId = data.channelId || UPDATE_CHANNEL_ID;

          if (!channelId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  'channelId tidak diberikan dan UPDATE_CHANNEL_ID belum di-set',
              })
            );
            return;
          }

          let channel;
          try {
            channel = await client.channels.fetch(channelId);
          } catch (e) {
            console.error(
              '[HTTP /api/new-update-sc] Gagal fetch channel:',
              e
            );
          }

          if (
            !channel ||
            !(
              channel.type === ChannelType.GuildText ||
              channel.type === ChannelType.GuildAnnouncement
            )
          ) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Channel tidak valid / bukan text channel',
              })
            );
            return;
          }

          const guild = channel.guild || null;

          const payload = buildScriptUpdatePayload(
            {
              scriptName,
              status,
              features,
              changeLogs,
              nextUpdate,
            },
            guild,
            client
          );

          await channel.send(payload);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error(
            '[HTTP /api/new-update-sc] Internal handler error:',
            err
          );
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({ ok: false, error: 'Internal server error' })
          );
        }
      });
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(
      `HTTP control server listening on port ${HTTP_PORT} (route: POST /api/new-update-sc)`
    );
  });
}

(async () => {
  try {
    if (!DISCORD_TOKEN || !CLIENT_ID) {
      console.error(
        'DISCORD_TOKEN atau CLIENT_ID belum di-set. Cek .env di Railway.'
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
