const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        return;
      }
      const key = trimmed.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) {
        return;
      }
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch (_error) {
    // If .env cannot be parsed we keep running with existing process.env.
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

const PUBLIC_FILES = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/sw.js"
]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const sessions = new Map();
const typingState = new Map();
const otpChallenges = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function now() {
  return Date.now();
}

function typingKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function clearExpiredTyping() {
  const ts = now();
  for (const [key, expiresAt] of typingState.entries()) {
    if (expiresAt <= ts) {
      typingState.delete(key);
    }
  }
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePin(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 4);
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePhoneLookup(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function defaultSettings() {
  return {
    readReceipts: true,
    typingIndicators: true,
    autoReply: false,
    customAutoReply: "",
    hideOnlineStatus: false,
    freezeLastSeen: false,
    antiDelete: true,
    dndMode: false,
    appLockEnabled: false,
    appLockPin: "2580",
    accentColor: "#d4af37",
    fontScale: 100
  };
}

function chatPrefTemplate() {
  return {
    pinned: false,
    muted: false,
    favorite: false,
    archived: false,
    lastReadAt: 0
  };
}

function newDatabase() {
  return {
    users: [],
    chats: [],
    messages: [],
    sessions: [],
    scheduled: []
  };
}

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(newDatabase(), null, 2), "utf8");
  }
}

ensureStorage();

function loadDatabase() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return newDatabase();
    }
    const db = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      sessions: [],
      scheduled: Array.isArray(parsed.scheduled) ? parsed.scheduled : []
    };
    db.users.forEach((user) => {
      user.settings = { ...defaultSettings(), ...(user.settings || {}) };
      user.settings.appLockPin = normalizePin(user.settings.appLockPin || "2580") || "2580";
      user.settings.fontScale = clampNumber(user.settings.fontScale, 90, 115, 100);
      user.settings.accentColor = normalizeAccent(user.settings.accentColor);
      if (["#00a884", "#050505", "#000000"].includes(String(user.settings.accentColor || "").toLowerCase())) {
        user.settings.accentColor = "#d4af37";
      }
      user.fullName = normalizeText(user.fullName || user.username || "Unknown User").slice(0, 60);
      user.email = normalizeEmail(user.email || "");
      user.phone = normalizePhone(user.phone || "").slice(0, 24);
      user.country = normalizeText(user.country || "").slice(0, 40);
      user.dateOfBirth = String(user.dateOfBirth || "");
      user.chatPrefs = user.chatPrefs || {};
      user.online = false;
      user.lastSeen = Number(user.lastSeen || now());
    });
    return db;
  } catch (error) {
    return newDatabase();
  }
}

let db = loadDatabase();

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeAccent(value) {
  const candidate = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : "#d4af37";
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index <= 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload, headers = {}) {
  const baseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  res.writeHead(statusCode, { ...baseHeaders, ...headers });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message });
}

function setSessionCookie(res, token) {
  const cookie = [
    `bg_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  const cookie = [
    "bg_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function findUserById(userId) {
  return db.users.find((user) => user.id === userId) || null;
}

function findUserByUsername(username) {
  const normalized = normalizeUsername(username).toLowerCase();
  return db.users.find((user) => user.username.toLowerCase() === normalized) || null;
}

function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return db.users.find((user) => normalizeEmail(user.email) === normalized) || null;
}

function findUserByPhone(phone) {
  const normalized = normalizePhoneLookup(phone);
  if (!normalized) return null;
  return db.users.find((user) => normalizePhoneLookup(user.phone) === normalized) || null;
}

function findUserByTarget(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  return findUserByUsername(input) || findUserByEmail(input) || findUserByPhone(input);
}

function suggestUsername(fullName, phone = "") {
  const nameSeed = normalizeUsername(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  const phoneSeed = normalizePhoneLookup(phone).slice(-4);
  let base = nameSeed || (phoneSeed ? `user_${phoneSeed}` : "new_user");
  if (base.length < 3) {
    base = `${base}_id`;
  }
  base = base.slice(0, 24);
  let candidate = base;
  let number = 1;
  while (findUserByUsername(candidate)) {
    const suffix = `_${number}`;
    candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    number += 1;
  }
  return candidate;
}

function uniqueUsers(users) {
  const map = new Map();
  users.filter(Boolean).forEach((user) => {
    map.set(user.id, user);
  });
  return [...map.values()];
}

function normalizePhoneInput(value) {
  const raw = normalizePhone(value);
  const digits = normalizePhoneLookup(raw);
  if (!digits) return "";
  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function otpKeyFromPhone(phone) {
  return normalizePhoneLookup(phone);
}

function isValidPhone(phone) {
  const digits = normalizePhoneLookup(phone);
  return digits.length >= 8 && digits.length <= 15;
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function envFlag(name, fallback = false) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function otpSmsProvider() {
  const raw = String(process.env.OTP_SMS_PROVIDER || "mimic").trim().toLowerCase();
  if (!raw || raw === "auto") {
    return "mimic";
  }
  if (raw === "mock" || raw === "demo") {
    return "mimic";
  }
  return raw;
}

function allowDevOtpCode() {
  if (envFlag("OTP_ALLOW_DEV_CODE", false)) {
    return true;
  }
  const provider = otpSmsProvider();
  return provider === "mimic" || provider === "log";
}

function clearExpiredOtp() {
  const ts = now();
  for (const [key, entry] of otpChallenges.entries()) {
    if (!entry || entry.expiresAt <= ts) {
      otpChallenges.delete(key);
    }
  }
}

function createPhoneBasedUser(phone) {
  const normalizedPhone = normalizePhoneInput(phone);
  const digits = normalizePhoneLookup(normalizedPhone);
  const suffix = digits.slice(-4) || String(Math.floor(Math.random() * 9000 + 1000));
  const user = {
    id: randomId("user"),
    username: suggestUsername(`user_${suffix}`, normalizedPhone),
    fullName: `User ${suffix}`,
    email: "",
    phone: normalizedPhone,
    country: "",
    dateOfBirth: "",
    passwordHash: hashPassword(randomId("pwd")),
    about: "Hey there! I am using BGWATSAPP.",
    settings: defaultSettings(),
    chatPrefs: {},
    createdAt: now(),
    lastSeen: now(),
    online: true
  };
  db.users.push(user);
  return user;
}

function otpSmsText(code) {
  const template = String(
    process.env.OTP_SMS_TEMPLATE || "Your BGWATSAPP verification code is {{code}}. It expires in {{minutes}} minutes."
  );
  const minutes = Math.max(1, Math.floor(OTP_TTL_MS / 60000));
  return template
    .replaceAll("{{code}}", code)
    .replaceAll("{{minutes}}", String(minutes));
}

function sendTwilioSms(to, text) {
  return new Promise((resolve, reject) => {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
    const fromNumber = String(process.env.TWILIO_FROM_NUMBER || "").trim();
    const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();

    if (!accountSid || !authToken) {
      reject(new Error("Twilio credentials are missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)."));
      return;
    }
    if (!fromNumber && !messagingServiceSid) {
      reject(new Error("Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID."));
      return;
    }

    const bodyParams = new URLSearchParams({
      To: to,
      Body: text
    });
    if (fromNumber) {
      bodyParams.set("From", fromNumber);
    } else {
      bodyParams.set("MessagingServiceSid", messagingServiceSid);
    }
    const body = bodyParams.toString();
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const req = https.request(
      {
        hostname: "api.twilio.com",
        port: 443,
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0);
          if (status >= 200 && status < 300) {
            resolve();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            reject(new Error(parsed.message || `Twilio returned status ${status}.`));
          } catch (_error) {
            reject(new Error(`Twilio returned status ${status}.`));
          }
        });
      }
    );

    req.on("error", (error) => reject(error));
    req.write(body);
    req.end();
  });
}

async function sendOtpSms(phone, code) {
  const provider = otpSmsProvider();
  if (!provider || provider === "none") {
    return { sent: false, provider: "none" };
  }
  const text = otpSmsText(code);
  if (provider === "twilio") {
    await sendTwilioSms(phone, text);
    return { sent: true, provider: "twilio" };
  }
  if (provider === "mimic") {
    // eslint-disable-next-line no-console
    console.log(`[BGWATSAPP OTP MIMIC] ${phone} code=${code}`);
    return { sent: false, provider: "mimic" };
  }
  if (provider === "log") {
    // eslint-disable-next-line no-console
    console.log(`[BGWATSAPP OTP LOG] ${phone} code=${code}`);
    return { sent: false, provider: "log" };
  }
  throw new Error("Unsupported OTP_SMS_PROVIDER. Supported values: twilio, mimic, log.");
}

function displayName(user) {
  if (!user) return "Unknown";
  return user.fullName || user.username || "Unknown";
}

function setTyping(chatId, userId, isTyping) {
  const key = typingKey(chatId, userId);
  if (isTyping) {
    typingState.set(key, now() + 4500);
    return;
  }
  typingState.delete(key);
}

function clearTypingForUser(userId) {
  for (const key of typingState.keys()) {
    if (key.endsWith(`:${userId}`)) {
      typingState.delete(key);
    }
  }
}

function activeTypingUsers(chat, viewerId) {
  clearExpiredTyping();
  return chat.members
    .filter((id) => id !== viewerId)
    .filter((id) => {
      const expiresAt = typingState.get(typingKey(chat.id, id)) || 0;
      return expiresAt > now();
    })
    .map((id) => findUserById(id))
    .filter(Boolean)
    .map((user) => displayName(user));
}

function createSessionForUser(user) {
  const token = randomId("sess");
  db.sessions = db.sessions.filter((entry) => entry.userId !== user.id);
  db.sessions.push({
    token,
    userId: user.id,
    createdAt: now(),
    expiresAt: now() + 1000 * 60 * 60 * 24 * 30
  });
  user.online = true;
  user.lastSeen = now();
  persist();
  return token;
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies.bg_session;
  if (!token) return null;
  const record = db.sessions.find((entry) => entry.token === token);
  if (!record) return null;
  if (record.expiresAt < now()) {
    db.sessions = db.sessions.filter((entry) => entry.token !== token);
    persist();
    return null;
  }
  const user = findUserById(record.userId);
  if (!user) return null;
  return { token, record, user };
}

function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "Authentication required");
    return null;
  }
  return session;
}

function getChatById(chatId) {
  return db.chats.find((chat) => chat.id === chatId) || null;
}

function isMember(chat, userId) {
  return chat.members.includes(userId);
}

function getChatMessages(chatId) {
  return db.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function getChatPrefs(user, chatId) {
  user.chatPrefs = user.chatPrefs || {};
  if (!user.chatPrefs[chatId]) {
    user.chatPrefs[chatId] = chatPrefTemplate();
  } else {
    user.chatPrefs[chatId] = { ...chatPrefTemplate(), ...user.chatPrefs[chatId] };
  }
  return user.chatPrefs[chatId];
}

function formatLastSeen(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `last seen today at ${hours}:${minutes}`;
}

function displayChatName(chat, userId) {
  if (chat.type === "group") return chat.name;
  const otherId = chat.members.find((id) => id !== userId);
  const other = findUserById(otherId);
  return other ? displayName(other) : "Unknown";
}

function displayChatStatus(chat, user) {
  if (chat.type === "group") {
    return `${chat.members.length} participants`;
  }
  const otherId = chat.members.find((id) => id !== user.id);
  const other = findUserById(otherId);
  if (!other) return "last seen recently";
  if (user.settings.hideOnlineStatus) return "last seen recently";
  if (user.settings.freezeLastSeen) return formatLastSeen(user.lastSeen);
  return other.online ? "online" : formatLastSeen(other.lastSeen || now());
}

function messageDeliveryForUser(message, viewer, chat) {
  if (!viewer || !chat) return null;
  if (message.senderId !== viewer.id) return null;

  const recipients = chat.members
    .filter((id) => id !== viewer.id)
    .map((id) => findUserById(id))
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      status: "sent",
      seenCount: 0,
      deliveredCount: 0,
      totalCount: 0
    };
  }

  let seenCount = 0;
  let deliveredCount = 0;
  recipients.forEach((recipient) => {
    const prefs = getChatPrefs(recipient, chat.id);
    const readAt = Number(prefs.lastReadAt || 0);
    const receiptsEnabled = !!(recipient.settings && recipient.settings.readReceipts);
    if (readAt >= message.createdAt && receiptsEnabled) {
      seenCount += 1;
      deliveredCount += 1;
      return;
    }
    if (readAt >= message.createdAt || recipient.online) {
      deliveredCount += 1;
    }
  });

  let status = "sent";
  if (seenCount === recipients.length) {
    status = "seen";
  } else if (deliveredCount > 0) {
    status = "delivered";
  }

  return {
    status,
    seenCount,
    deliveredCount,
    totalCount: recipients.length
  };
}

function replyPreview(replyToId) {
  if (!replyToId) return null;
  const target = db.messages.find((item) => item.id === replyToId);
  if (!target) {
    return {
      id: replyToId,
      text: "Original message unavailable",
      senderUsername: "Unknown"
    };
  }
  const sender = findUserById(target.senderId);
  return {
    id: target.id,
    text: String(target.text || "").slice(0, 160),
    senderUsername: sender ? displayName(sender) : "Unknown"
  };
}

function serializeMessage(message, viewer = null) {
  const sender = findUserById(message.senderId);
  const chat = getChatById(message.chatId);
  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    senderUsername: sender ? displayName(sender) : "Unknown",
    senderHandle: sender ? sender.username : "unknown",
    kind: message.kind,
    text: message.text,
    replyToId: message.replyToId || null,
    replyTo: replyPreview(message.replyToId),
    delivery: messageDeliveryForUser(message, viewer, chat),
    createdAt: message.createdAt,
    deleted: !!message.deleted
  };
}

function unreadCountForChat(chat, user) {
  if (user.settings.dndMode) return 0;
  const prefs = getChatPrefs(user, chat.id);
  const lastReadAt = Number(prefs.lastReadAt || 0);
  return db.messages.reduce((count, message) => {
    if (message.chatId !== chat.id) return count;
    if (message.senderId === user.id) return count;
    if (message.createdAt <= lastReadAt) return count;
    return count + 1;
  }, 0);
}

function serializeChatForUser(chat, user) {
  const messages = getChatMessages(chat.id);
  const lastMessage = messages[messages.length - 1] || null;
  const prefs = getChatPrefs(user, chat.id);
  const typingUsers = activeTypingUsers(chat, user.id);
  let status = displayChatStatus(chat, user);
  if (typingUsers.length > 0 && user.settings.typingIndicators) {
    status = chat.type === "group" ? `${typingUsers[0]} typing...` : "typing...";
  }
  return {
    id: chat.id,
    type: chat.type,
    name: displayChatName(chat, user.id),
    status,
    typingUsers,
    updatedAt: chat.updatedAt || chat.createdAt,
    members: chat.members
      .map((id) => findUserById(id))
      .filter(Boolean)
      .map((member) => displayName(member)),
    prefs,
    unreadCount: unreadCountForChat(chat, user),
    lastMessage: lastMessage ? serializeMessage(lastMessage, user) : null
  };
}

function serializeSettings(settings) {
  return {
    readReceipts: !!settings.readReceipts,
    typingIndicators: !!settings.typingIndicators,
    autoReply: !!settings.autoReply,
    customAutoReply: String(settings.customAutoReply || ""),
    hideOnlineStatus: !!settings.hideOnlineStatus,
    freezeLastSeen: !!settings.freezeLastSeen,
    antiDelete: !!settings.antiDelete,
    dndMode: !!settings.dndMode,
    appLockEnabled: !!settings.appLockEnabled,
    hasAppLockPin: normalizePin(settings.appLockPin || "").length === 4,
    accentColor: normalizeAccent(settings.accentColor),
    fontScale: clampNumber(settings.fontScale, 90, 115, 100)
  };
}

function serializeMe(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName || user.username,
    email: user.email || "",
    phone: user.phone || "",
    country: user.country || "",
    dateOfBirth: user.dateOfBirth || "",
    about: user.about || "",
    online: !!user.online,
    lastSeen: user.lastSeen || now(),
    settings: serializeSettings(user.settings || defaultSettings())
  };
}

function notifyUsers(userIds, payload) {
  const uniqueUserIds = [...new Set(userIds)];
  uniqueUserIds.forEach((userId) => {
    const listeners = sessions.get(userId);
    if (!listeners || listeners.size === 0) return;
    const packet = `event: update\ndata: ${JSON.stringify(payload)}\n\n`;
    listeners.forEach((res) => {
      try {
        res.write(packet);
      } catch (error) {
        listeners.delete(res);
      }
    });
  });
}

function notifyChatMembers(chat, reason) {
  notifyUsers(chat.members, { type: "refresh", reason, chatId: chat.id, ts: now() });
}

function addSseListener(userId, res) {
  if (!sessions.has(userId)) {
    sessions.set(userId, new Set());
  }
  sessions.get(userId).add(res);
}

function removeSseListener(userId, res) {
  const listeners = sessions.get(userId);
  if (!listeners) return;
  listeners.delete(res);
  if (listeners.size === 0) {
    sessions.delete(userId);
  }
}

function touchRead(user, chatId, at = now()) {
  const prefs = getChatPrefs(user, chatId);
  prefs.lastReadAt = at;
}

function cannedAutoReply() {
  const options = [
    "Nice. I got your message.",
    "Got it, I will get back to you shortly.",
    "Thanks for the update.",
    "Understood, continuing now."
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function appendMessage({ chat, senderId, text, kind = "text", replyToId = null, skipAutoReply = false }) {
  const message = {
    id: randomId("msg"),
    chatId: chat.id,
    senderId,
    kind,
    text: String(text || "").slice(0, 4000),
    replyToId: replyToId || null,
    createdAt: now(),
    deleted: false
  };

  db.messages.push(message);
  chat.updatedAt = message.createdAt;

  const sender = findUserById(senderId);
  if (sender) {
    touchRead(sender, chat.id, message.createdAt);
  }

  persist();
  notifyChatMembers(chat, "message");

  if (!skipAutoReply) {
    maybeAutoReply(chat, message);
  }

  return message;
}

function maybeAutoReply(chat, originMessage) {
  if (chat.type !== "direct") return;
  const recipientId = chat.members.find((id) => id !== originMessage.senderId);
  if (!recipientId) return;
  const recipient = findUserById(recipientId);
  if (!recipient) return;
  if (!recipient.settings.autoReply) return;
  const replyText = recipient.settings.customAutoReply.trim() || cannedAutoReply();
  const delay = 900 + Math.floor(Math.random() * 1000);
  setTimeout(() => {
    const latestChat = getChatById(chat.id);
    if (!latestChat) return;
    if (!isMember(latestChat, recipientId)) return;
    appendMessage({
      chat: latestChat,
      senderId: recipientId,
      text: replyText,
      kind: "text",
      skipAutoReply: true
    });
  }, delay);
}

function createDirectChat(userAId, userBId) {
  const existing = db.chats.find(
    (chat) =>
      chat.type === "direct" &&
      chat.members.length === 2 &&
      chat.members.includes(userAId) &&
      chat.members.includes(userBId)
  );
  if (existing) return existing;

  const created = {
    id: randomId("chat"),
    type: "direct",
    name: "",
    members: [userAId, userBId],
    createdAt: now(),
    updatedAt: now(),
    createdBy: userAId
  };
  db.chats.push(created);
  const memberA = findUserById(userAId);
  const memberB = findUserById(userBId);
  if (memberA) getChatPrefs(memberA, created.id);
  if (memberB) getChatPrefs(memberB, created.id);
  persist();
  notifyChatMembers(created, "chat_created");
  return created;
}

function createGroupChat(creator, name, memberUsers) {
  const members = [creator.id, ...memberUsers.map((user) => user.id)];
  const uniqueMembers = [...new Set(members)];
  const chat = {
    id: randomId("chat"),
    type: "group",
    name: String(name || "New Group").slice(0, 60),
    members: uniqueMembers,
    createdAt: now(),
    updatedAt: now(),
    createdBy: creator.id
  };
  db.chats.push(chat);
  uniqueMembers.forEach((id) => {
    const user = findUserById(id);
    if (user) getChatPrefs(user, chat.id);
  });
  persist();
  notifyChatMembers(chat, "chat_created");
  return chat;
}

function updateUserSettings(user, payload) {
  const current = { ...defaultSettings(), ...(user.settings || {}) };
  const next = { ...current };
  const booleanKeys = [
    "readReceipts",
    "typingIndicators",
    "autoReply",
    "hideOnlineStatus",
    "freezeLastSeen",
    "antiDelete",
    "dndMode",
    "appLockEnabled"
  ];
  booleanKeys.forEach((key) => {
    if (key in payload) {
      next[key] = !!payload[key];
    }
  });

  if ("customAutoReply" in payload) {
    next.customAutoReply = String(payload.customAutoReply || "").slice(0, 200);
  }
  if ("accentColor" in payload) {
    next.accentColor = normalizeAccent(payload.accentColor);
  }
  if ("fontScale" in payload) {
    next.fontScale = clampNumber(payload.fontScale, 90, 115, 100);
  }
  if ("appLockPin" in payload) {
    const normalized = normalizePin(payload.appLockPin);
    if (normalized.length === 4) {
      next.appLockPin = normalized;
    }
  }

  user.settings = next;
  persist();
}

function routeSegments(pathname) {
  return pathname.split("/").filter(Boolean);
}

function safeScheduledItem(item, user) {
  const chat = getChatById(item.chatId);
  if (!chat || !isMember(chat, user.id)) return null;
  return {
    id: item.id,
    chatId: item.chatId,
    chatName: displayChatName(chat, user.id),
    text: item.text,
    runAt: item.runAt,
    createdAt: item.createdAt
  };
}

function runScheduledQueue() {
  clearExpiredTyping();
  clearExpiredOtp();
  if (!db.scheduled.length) return;
  const due = db.scheduled.filter((item) => item.runAt <= now());
  if (!due.length) return;

  due.forEach((item) => {
    const chat = getChatById(item.chatId);
    const user = findUserById(item.userId);
    if (!chat || !user) return;
    if (!isMember(chat, user.id)) return;
    appendMessage({
      chat,
      senderId: user.id,
      text: `[Scheduled] ${item.text}`,
      kind: "text"
    });
  });

  db.scheduled = db.scheduled.filter((item) => item.runAt > now());
  persist();
}

setInterval(runScheduledQueue, 4000);

async function handleApi(req, res, pathname, url) {
  const method = req.method || "GET";
  const segments = routeSegments(pathname);

  if (pathname === "/api/me" && method === "GET") {
    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(res, 200, { ok: true, authenticated: false });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: serializeMe(session.user)
    });
    return;
  }

  if (pathname === "/api/auth/request-code" && method === "POST") {
    const body = await readBody(req);
    const phone = normalizePhoneInput(body.phone);
    if (!isValidPhone(phone)) {
      sendError(res, 400, "Enter a valid phone number with country code.");
      return;
    }

    clearExpiredOtp();
    const key = otpKeyFromPhone(phone);
    const existing = otpChallenges.get(key);
    if (existing && existing.lastSentAt + OTP_RESEND_MS > now()) {
      const retrySeconds = Math.ceil((existing.lastSentAt + OTP_RESEND_MS - now()) / 1000);
      sendError(res, 429, `Please wait ${retrySeconds}s before requesting another code.`);
      return;
    }

    const code = createOtpCode();
    otpChallenges.set(key, {
      phone,
      codeHash: hashPassword(code),
      expiresAt: now() + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now()
    });
    let smsDelivery = "sms";
    try {
      const delivery = await sendOtpSms(phone, code);
      if (delivery.sent) {
        smsDelivery = delivery.provider;
      } else {
        smsDelivery = delivery.provider || "dev";
        if (!allowDevOtpCode()) {
          otpChallenges.delete(key);
          sendError(
            res,
            503,
            "SMS delivery is not configured. Set OTP_SMS_PROVIDER=twilio with TWILIO credentials, or use OTP_SMS_PROVIDER=mimic."
          );
          return;
        }
      }
    } catch (error) {
      otpChallenges.delete(key);
      sendError(res, 502, `Failed to send SMS code: ${error.message}`);
      return;
    }

    const payload = {
      ok: true,
      phone,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      delivery: smsDelivery
    };
    if (allowDevOtpCode()) {
      payload.devCode = code;
    }
    sendJson(res, 200, payload);
    return;
  }

  if (pathname === "/api/auth/verify-code" && method === "POST") {
    const body = await readBody(req);
    const phone = normalizePhoneInput(body.phone);
    const code = String(body.code || "").trim();
    if (!isValidPhone(phone)) {
      sendError(res, 400, "Enter a valid phone number.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      sendError(res, 400, "Verification code must be 6 digits.");
      return;
    }

    clearExpiredOtp();
    const key = otpKeyFromPhone(phone);
    const challenge = otpChallenges.get(key);
    if (!challenge) {
      sendError(res, 400, "Code expired or not requested. Request a new code.");
      return;
    }
    if (challenge.expiresAt <= now()) {
      otpChallenges.delete(key);
      sendError(res, 400, "Code expired. Request a new code.");
      return;
    }
    if (challenge.codeHash !== hashPassword(code)) {
      challenge.attempts = Number(challenge.attempts || 0) + 1;
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        otpChallenges.delete(key);
        sendError(res, 401, "Too many wrong attempts. Request a new code.");
        return;
      }
      otpChallenges.set(key, challenge);
      sendError(res, 401, "Invalid code.");
      return;
    }

    otpChallenges.delete(key);
    let user = findUserByPhone(phone);
    const created = !user;
    if (!user) {
      user = createPhoneBasedUser(phone);
    } else {
      user.phone = normalizePhoneInput(user.phone || phone);
      user.fullName = normalizeText(user.fullName || user.username || "User");
    }

    const token = createSessionForUser(user);
    setSessionCookie(res, token);
    sendJson(res, 200, {
      ok: true,
      created,
      user: serializeMe(user)
    });
    return;
  }

  if (pathname === "/api/register" && method === "POST") {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const fullName = normalizeText(body.fullName).slice(0, 60);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone).slice(0, 24);
    const country = normalizeText(body.country).slice(0, 40);
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const about = normalizeText(body.about || "Hey there! I am using BGWATSAPP.").slice(0, 160);

    if (!/^[a-zA-Z0-9_ ]{3,24}$/.test(username)) {
      sendError(res, 400, "Username must be 3-24 chars (letters, numbers, spaces, underscore).");
      return;
    }
    if (fullName.length < 2) {
      sendError(res, 400, "Full name must be at least 2 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 400, "A valid email address is required.");
      return;
    }
    if (phone && !/^\+?[0-9\- ]{7,20}$/.test(phone)) {
      sendError(res, 400, "Phone must be 7-20 digits and may include +, space, or dash.");
      return;
    }
    if (country && country.length < 2) {
      sendError(res, 400, "Country name looks too short.");
      return;
    }
    if (dateOfBirth) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        sendError(res, 400, "Date of birth must use YYYY-MM-DD format.");
        return;
      }
      const dobDate = new Date(`${dateOfBirth}T00:00:00Z`);
      const minAgeCutoff = new Date();
      minAgeCutoff.setFullYear(minAgeCutoff.getFullYear() - 13);
      if (Number.isNaN(dobDate.getTime()) || dobDate > minAgeCutoff) {
        sendError(res, 400, "Account owner must be at least 13 years old.");
        return;
      }
    }
    if (password.length < 4) {
      sendError(res, 400, "Password must be at least 4 characters.");
      return;
    }
    if (findUserByUsername(username)) {
      sendError(res, 409, "That username is already taken.");
      return;
    }
    if (findUserByEmail(email)) {
      sendError(res, 409, "That email address is already registered.");
      return;
    }
    if (phone && findUserByPhone(phone)) {
      sendError(res, 409, "That phone number is already registered.");
      return;
    }

    const user = {
      id: randomId("user"),
      username,
      fullName,
      email,
      phone,
      country,
      dateOfBirth,
      passwordHash: hashPassword(password),
      about,
      settings: defaultSettings(),
      chatPrefs: {},
      createdAt: now(),
      lastSeen: now(),
      online: true
    };
    db.users.push(user);
    const token = createSessionForUser(user);
    setSessionCookie(res, token);
    sendJson(res, 201, { ok: true, user: serializeMe(user) });
    return;
  }

  if (pathname === "/api/login" && method === "POST") {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const user = findUserByUsername(username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      sendError(res, 401, "Invalid username or password.");
      return;
    }
    const token = createSessionForUser(user);
    setSessionCookie(res, token);
    sendJson(res, 200, { ok: true, user: serializeMe(user) });
    return;
  }

  if (pathname === "/api/logout" && method === "POST") {
    const session = getSessionFromRequest(req);
    if (session) {
      clearTypingForUser(session.user.id);
      db.sessions = db.sessions.filter((entry) => entry.token !== session.token);
      const hasOtherSessions = db.sessions.some((entry) => entry.userId === session.user.id);
      if (!hasOtherSessions) {
        session.user.online = false;
        session.user.lastSeen = now();
      }
      persist();
    }
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (segments[0] === "api" && segments[1] === "chats" && segments[2] && segments[3] === "typing" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chat = getChatById(segments[2]);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    const body = await readBody(req);
    setTyping(chat.id, session.user.id, !!body.typing);
    notifyChatMembers(chat, "typing");
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/unlock" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const pin = normalizePin(body.pin);
    const expected = normalizePin(session.user.settings.appLockPin || "2580");
    if (!pin || pin !== expected) {
      sendError(res, 403, "Incorrect PIN.");
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/stream" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    res.write(`event: update\ndata: ${JSON.stringify({ type: "connected", ts: now() })}\n\n`);
    addSseListener(session.user.id, res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${now()}\n\n`);
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeSseListener(session.user.id, res);
    });
    return;
  }

  if (pathname === "/api/users" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const users = db.users
      .filter((user) => user.id !== session.user.id)
      .filter((user) => {
        if (!query) return true;
        const haystack = [user.username, user.fullName, user.email, user.phone]
          .map((value) => String(value || "").toLowerCase());
        return haystack.some((value) => value.includes(query));
      })
      .slice(0, 30)
      .map((user) => ({
        id: user.id,
        username: user.username,
        fullName: displayName(user),
        phone: user.phone || "",
        email: user.email || "",
        online: !!user.online,
        lastSeen: user.lastSeen || now()
      }));
    sendJson(res, 200, { ok: true, users });
    return;
  }

  if (pathname === "/api/chats" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chats = db.chats
      .filter((chat) => isMember(chat, session.user.id))
      .map((chat) => serializeChatForUser(chat, session.user))
      .sort((a, b) => {
        if (a.prefs.pinned !== b.prefs.pinned) {
          return a.prefs.pinned ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      });
    sendJson(res, 200, { ok: true, chats });
    return;
  }

  if (pathname === "/api/chats" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const type = body.type === "group" ? "group" : "direct";

    if (type === "direct") {
      const targetInput = body.target || body.targetUsername;
      const target = findUserByTarget(targetInput);
      if (!target) {
        sendError(res, 404, "Target user not found. Use username, phone, or email.");
        return;
      }
      if (target.id === session.user.id) {
        sendError(res, 400, "Cannot create a direct chat with yourself.");
        return;
      }
      const chat = createDirectChat(session.user.id, target.id);
      sendJson(res, 201, { ok: true, chat: serializeChatForUser(chat, session.user) });
      return;
    }

    const name = String(body.name || "").trim();
    if (name.length < 2) {
      sendError(res, 400, "Group name must be at least 2 characters.");
      return;
    }
    const memberNames = Array.isArray(body.memberUsernames) ? body.memberUsernames : [];
    const members = memberNames
      .map((item) => findUserByUsername(item))
      .filter(Boolean)
      .filter((member) => member.id !== session.user.id);
    if (members.length === 0) {
      sendError(res, 400, "Group needs at least one valid member username.");
      return;
    }
    const chat = createGroupChat(session.user, name, members);
    sendJson(res, 201, { ok: true, chat: serializeChatForUser(chat, session.user) });
    return;
  }

  if (pathname === "/api/contacts" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const fullName = normalizeText(body.fullName).slice(0, 60);
    const requestedUsername = normalizeUsername(body.username);
    const username = requestedUsername || suggestUsername(fullName, body.phone);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone).slice(0, 24);
    const country = normalizeText(body.country).slice(0, 40);
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const about = normalizeText(body.about || "Hey there! I am using BGWATSAPP.").slice(0, 160);
    const passwordSeed = String(body.password || randomId("pwd")).slice(0, 24);

    if (fullName.length < 2) {
      sendError(res, 400, "Contact full name must be at least 2 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_ ]{3,24}$/.test(username)) {
      sendError(res, 400, "Username must be 3-24 chars (letters, numbers, spaces, underscore).");
      return;
    }
    if (!phone && !email) {
      sendError(res, 400, "Add at least a phone number or email for this contact.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 400, "Email format is invalid.");
      return;
    }
    if (phone && !/^\+?[0-9\- ]{7,20}$/.test(phone)) {
      sendError(res, 400, "Phone must be 7-20 digits and may include +, space, or dash.");
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      sendError(res, 400, "Date of birth must use YYYY-MM-DD format.");
      return;
    }
    const existingMatches = uniqueUsers([
      requestedUsername ? findUserByUsername(requestedUsername) : null,
      email ? findUserByEmail(email) : null,
      phone ? findUserByPhone(phone) : null
    ]);

    if (existingMatches.length > 1) {
      sendError(res, 409, "These contact details match multiple accounts. Use one exact identifier.");
      return;
    }

    if (existingMatches.length === 1) {
      const existing = existingMatches[0];
      if (existing.id === session.user.id) {
        sendError(res, 400, "You cannot create a contact card for your own account.");
        return;
      }
      if (email && normalizeEmail(existing.email) && normalizeEmail(existing.email) !== email) {
        sendError(res, 409, "The provided email does not match that existing account.");
        return;
      }
      if (phone) {
        const existingPhone = normalizePhoneLookup(existing.phone);
        const candidatePhone = normalizePhoneLookup(phone);
        if (existingPhone && candidatePhone && existingPhone !== candidatePhone) {
          sendError(res, 409, "The provided phone does not match that existing account.");
          return;
        }
      }
      const chat = createDirectChat(session.user.id, existing.id);
      sendJson(res, 200, {
        ok: true,
        created: false,
        user: {
          id: existing.id,
          username: existing.username,
          fullName: existing.fullName || existing.username,
          email: existing.email || "",
          phone: existing.phone || ""
        },
        chat: serializeChatForUser(chat, session.user)
      });
      return;
    }

    const user = {
      id: randomId("user"),
      username,
      fullName,
      email,
      phone,
      country,
      dateOfBirth,
      passwordHash: hashPassword(passwordSeed),
      about,
      settings: defaultSettings(),
      chatPrefs: {},
      createdAt: now(),
      lastSeen: now(),
      online: false
    };

    db.users.push(user);
    const chat = createDirectChat(session.user.id, user.id);
    sendJson(res, 201, {
      ok: true,
      created: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone
      },
      chat: serializeChatForUser(chat, session.user)
    });
    return;
  }

  if (segments[0] === "api" && segments[1] === "chat-prefs" && segments[2] && method === "PUT") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chat = getChatById(segments[2]);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    const body = await readBody(req);
    const prefs = getChatPrefs(session.user, chat.id);
    ["pinned", "muted", "favorite", "archived"].forEach((key) => {
      if (key in body) {
        prefs[key] = !!body[key];
      }
    });
    if ("lastReadAt" in body) {
      prefs.lastReadAt = Number(body.lastReadAt || now());
    }
    persist();
    notifyUsers([session.user.id], { type: "refresh", reason: "chat_prefs", chatId: chat.id, ts: now() });
    sendJson(res, 200, { ok: true, prefs });
    return;
  }

  if (segments[0] === "api" && segments[1] === "chats" && segments[2] && segments[3] === "messages" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chat = getChatById(segments[2]);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    const limit = clampNumber(url.searchParams.get("limit") || 300, 20, 1000, 300);
    const messages = getChatMessages(chat.id).slice(-limit).map((message) => serializeMessage(message, session.user));
    sendJson(res, 200, { ok: true, messages });
    return;
  }

  if (segments[0] === "api" && segments[1] === "chats" && segments[2] && segments[3] === "messages" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chat = getChatById(segments[2]);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    const replyToId = body.replyToId ? String(body.replyToId) : null;
    if (!text) {
      sendError(res, 400, "Message text is required.");
      return;
    }
    if (replyToId) {
      const target = db.messages.find((item) => item.id === replyToId);
      if (!target || target.chatId !== chat.id) {
        sendError(res, 400, "Reply target is invalid for this chat.");
        return;
      }
    }
    const message = appendMessage({
      chat,
      senderId: session.user.id,
      text,
      kind: "text",
      replyToId
    });
    sendJson(res, 201, { ok: true, message: serializeMessage(message, session.user) });
    return;
  }

  if (segments[0] === "api" && segments[1] === "chats" && segments[2] && segments[3] === "read" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const chat = getChatById(segments[2]);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    touchRead(session.user, chat.id, now());
    persist();
    notifyUsers([session.user.id], { type: "refresh", reason: "read", chatId: chat.id, ts: now() });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/settings" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    sendJson(res, 200, { ok: true, settings: serializeSettings(session.user.settings) });
    return;
  }

  if (pathname === "/api/settings" && method === "PUT") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    updateUserSettings(session.user, body);
    if (session.user.settings.dndMode) {
      db.chats
        .filter((chat) => isMember(chat, session.user.id))
        .forEach((chat) => touchRead(session.user, chat.id, now()));
      persist();
    }
    notifyUsers([session.user.id], { type: "refresh", reason: "settings", ts: now() });
    sendJson(res, 200, { ok: true, settings: serializeSettings(session.user.settings) });
    return;
  }

  if (pathname === "/api/scheduled" && method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    const items = db.scheduled
      .filter((item) => item.userId === session.user.id)
      .map((item) => safeScheduledItem(item, session.user))
      .filter(Boolean)
      .sort((a, b) => a.runAt - b.runAt);
    sendJson(res, 200, { ok: true, items });
    return;
  }

  if (pathname === "/api/scheduled" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const chat = getChatById(body.chatId);
    if (!chat || !isMember(chat, session.user.id)) {
      sendError(res, 404, "Chat not found.");
      return;
    }
    const text = String(body.text || "").trim();
    const runAt = Number(body.runAt || 0);
    if (!text) {
      sendError(res, 400, "Scheduled message needs text.");
      return;
    }
    if (!runAt || runAt < now() + 15000) {
      sendError(res, 400, "Scheduled time must be at least 15 seconds in the future.");
      return;
    }
    const item = {
      id: randomId("sched"),
      userId: session.user.id,
      chatId: chat.id,
      text: text.slice(0, 2000),
      runAt,
      createdAt: now()
    };
    db.scheduled.push(item);
    persist();
    notifyUsers([session.user.id], { type: "refresh", reason: "scheduled", chatId: chat.id, ts: now() });
    sendJson(res, 201, { ok: true, item: safeScheduledItem(item, session.user) });
    return;
  }

  if (segments[0] === "api" && segments[1] === "scheduled" && segments[2] && method === "DELETE") {
    const session = requireAuth(req, res);
    if (!session) return;
    const id = segments[2];
    const before = db.scheduled.length;
    db.scheduled = db.scheduled.filter((item) => !(item.id === id && item.userId === session.user.id));
    if (db.scheduled.length === before) {
      sendError(res, 404, "Scheduled item not found.");
      return;
    }
    persist();
    notifyUsers([session.user.id], { type: "refresh", reason: "scheduled_delete", ts: now() });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/broadcast" && method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) {
      sendError(res, 400, "Broadcast text is required.");
      return;
    }
    const targetChats = db.chats.filter(
      (chat) => chat.type === "direct" && isMember(chat, session.user.id)
    );
    targetChats.forEach((chat) => {
      appendMessage({
        chat,
        senderId: session.user.id,
        text: `[Broadcast] ${text}`,
        kind: "text"
      });
    });
    sendJson(res, 200, { ok: true, count: targetChats.length });
    return;
  }

  sendError(res, 404, "API route not found.");
}

function serveStatic(res, pathname) {
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  if (!PUBLIC_FILES.has(targetPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const filePath = path.join(ROOT_DIR, targetPath.slice(1));
  const extension = path.extname(filePath);
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";
  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname, url);
      return;
    }

    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    serveStatic(res, pathname);
  } catch (error) {
    sendError(res, 500, "Internal server error.");
  }
});

server.listen(PORT, () => {
  const address = `http://localhost:${PORT}`;
  const provider = otpSmsProvider();
  const devFallback = allowDevOtpCode() ? "enabled" : "disabled";
  // eslint-disable-next-line no-console
  console.log(`BGWATSAPP server running at ${address}`);
  // eslint-disable-next-line no-console
  console.log(`OTP provider: ${provider} (dev code fallback: ${devFallback})`);
});
