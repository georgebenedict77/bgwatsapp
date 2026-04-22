const state = {
  me: null,
  chats: [],
  activeChatId: null,
  messagesByChat: {},
  scheduled: [],
  chatSearch: "",
  chatFilter: "all",
  unlocked: true,
  refreshTimer: null,
  stream: null,
  replyTo: null,
  typingTimer: null,
  typingActive: false,
  messageSearchQuery: "",
  pendingPhone: "",
  sidebarView: "chats",
  directoryUsers: [],
  actionMode: "direct"
};

const els = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  phoneAuthForm: document.getElementById("phoneAuthForm"),
  phoneInput: document.getElementById("phoneInput"),
  sendCodeButton: document.getElementById("sendCodeButton"),
  liveAppUrl: document.getElementById("liveAppUrl"),
  copyLiveUrlButton: document.getElementById("copyLiveUrlButton"),
  openLiveUrlLink: document.getElementById("openLiveUrlLink"),
  liveUrlHint: document.getElementById("liveUrlHint"),
  otpForm: document.getElementById("otpForm"),
  otpInput: document.getElementById("otpInput"),
  changePhoneButton: document.getElementById("changePhoneButton"),
  authHint: document.getElementById("authHint"),
  authError: document.getElementById("authError"),
  navChatsButton: document.getElementById("navChatsButton"),
  navContactsButton: document.getElementById("navContactsButton"),
  navGroupsButton: document.getElementById("navGroupsButton"),
  navSettingsButton: document.getElementById("navSettingsButton"),
  navLogoutButton: document.getElementById("navLogoutButton"),
  meUsername: document.getElementById("meUsername"),
  mePersonInfo: document.getElementById("mePersonInfo"),
  sidebarTitle: document.getElementById("sidebarTitle"),
  sidebarSubtitle: document.getElementById("sidebarSubtitle"),
  directoryTools: document.getElementById("directoryTools"),
  openContactCreateButton: document.getElementById("openContactCreateButton"),
  openGroupCreateButton: document.getElementById("openGroupCreateButton"),
  chatSearchInput: document.getElementById("chatSearchInput"),
  filterChips: Array.from(document.querySelectorAll(".filter-chip")),
  chatList: document.getElementById("chatList"),
  activeChatName: document.getElementById("activeChatName"),
  activeChatStatus: document.getElementById("activeChatStatus"),
  searchInChatButton: document.getElementById("searchInChatButton"),
  favoriteChatButton: document.getElementById("favoriteChatButton"),
  muteChatButton: document.getElementById("muteChatButton"),
  pinChatButton: document.getElementById("pinChatButton"),
  messageList: document.getElementById("messageList"),
  messageForm: document.getElementById("messageForm"),
  messageInput: document.getElementById("messageInput"),
  replyBar: document.getElementById("replyBar"),
  replyToName: document.getElementById("replyToName"),
  replyToText: document.getElementById("replyToText"),
  cancelReplyButton: document.getElementById("cancelReplyButton"),
  markReadButton: document.getElementById("markReadButton"),
  mobileBackButton: document.getElementById("mobileBackButton"),
  settingsDrawer: document.getElementById("settingsDrawer"),
  closeSettingsButton: document.getElementById("closeSettingsButton"),
  settingsStatus: document.getElementById("settingsStatus"),
  meAvatar: document.getElementById("meAvatar"),
  activeChatAvatar: document.getElementById("activeChatAvatar"),
  toggleReadReceipts: document.getElementById("toggleReadReceipts"),
  toggleTyping: document.getElementById("toggleTyping"),
  toggleAutoReply: document.getElementById("toggleAutoReply"),
  toggleHideOnline: document.getElementById("toggleHideOnline"),
  toggleFreezeLastSeen: document.getElementById("toggleFreezeLastSeen"),
  toggleAntiDelete: document.getElementById("toggleAntiDelete"),
  toggleDnd: document.getElementById("toggleDnd"),
  accentColorInput: document.getElementById("accentColorInput"),
  fontScaleInput: document.getElementById("fontScaleInput"),
  toggleAppLock: document.getElementById("toggleAppLock"),
  appLockPinInput: document.getElementById("appLockPinInput"),
  customAutoReplyInput: document.getElementById("customAutoReplyInput"),
  broadcastInput: document.getElementById("broadcastInput"),
  broadcastButton: document.getElementById("broadcastButton"),
  scheduleChatSelect: document.getElementById("scheduleChatSelect"),
  scheduleTextInput: document.getElementById("scheduleTextInput"),
  scheduleTimeInput: document.getElementById("scheduleTimeInput"),
  scheduleButton: document.getElementById("scheduleButton"),
  scheduledList: document.getElementById("scheduledList"),
  lockOverlay: document.getElementById("lockOverlay"),
  unlockForm: document.getElementById("unlockForm"),
  unlockPin: document.getElementById("unlockPin"),
  unlockError: document.getElementById("unlockError"),
  chatSidebar: document.getElementById("chatSidebar"),
  actionModal: document.getElementById("actionModal"),
  actionModalTitle: document.getElementById("actionModalTitle"),
  actionCloseButton: document.getElementById("actionCloseButton"),
  directActionForm: document.getElementById("directActionForm"),
  directTargetInput: document.getElementById("directTargetInput"),
  directError: document.getElementById("directError"),
  directOpenContactButton: document.getElementById("directOpenContactButton"),
  contactActionForm: document.getElementById("contactActionForm"),
  contactFullName: document.getElementById("contactFullName"),
  contactPhone: document.getElementById("contactPhone"),
  contactEmail: document.getElementById("contactEmail"),
  contactUsername: document.getElementById("contactUsername"),
  contactBackButton: document.getElementById("contactBackButton"),
  contactError: document.getElementById("contactError"),
  groupActionForm: document.getElementById("groupActionForm"),
  groupNameInput: document.getElementById("groupNameInput"),
  groupMembersInput: document.getElementById("groupMembersInput"),
  groupError: document.getElementById("groupError")
};

function toLocalDateTimeInput(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function defaultScheduleTimeValue() {
  const ts = Date.now() + 5 * 60 * 1000;
  return toLocalDateTimeInput(ts);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initialsForName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function colorFromText(text) {
  let hash = 0;
  const source = String(text || "bgwatsapp");
  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 52% 42%)`;
}

function avatarHtml(name, sizeClass = "") {
  const initials = initialsForName(name);
  const color = colorFromText(name);
  const classes = sizeClass ? `avatar ${sizeClass}` : "avatar";
  return `<span class="${classes}" style="background:${color}">${escapeHtml(initials)}</span>`;
}

function formatShortTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatListDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return formatShortTime(timestamp);
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDayLabel(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function userDisplayName(user) {
  if (!user) return "Unknown";
  return user.fullName || user.username || "Unknown";
}

function profileDetailsLine(user) {
  if (!user) return "";
  const bits = [`@${user.username}`];
  if (user.email) bits.push(user.email);
  if (user.phone) bits.push(user.phone);
  return bits.join("  |  ");
}

function formatPreview(chat) {
  if (!chat || !chat.lastMessage) {
    return "Start chatting.";
  }
  const { lastMessage } = chat;
  const text = String(lastMessage.text || "").trim() || "Message";
  if (lastMessage.senderId === state.me.id) {
    return `You: ${text}`;
  }
  if (chat.type === "group") {
    const senderName = lastMessage.senderUsername || lastMessage.senderHandle || "Member";
    return `${senderName}: ${text}`;
  }
  return text;
}

function isChatOnline(chat) {
  if (!chat || chat.type !== "direct") return false;
  const status = String(chat.status || "").toLowerCase();
  return status === "online";
}

function messageStatusMarkup(message) {
  if (!state.me || !message || message.senderId !== state.me.id) return "";
  const status = (message.delivery && message.delivery.status) || "sent";
  if (status === "seen") {
    return '<span class="msg-ticks is-seen">&#10003;&#10003;</span>';
  }
  if (status === "delivered") {
    return '<span class="msg-ticks">&#10003;&#10003;</span>';
  }
  return '<span class="msg-ticks is-sent">&#10003;</span>';
}

function trimForReply(text) {
  const source = String(text || "").trim();
  if (source.length <= 80) return source;
  return `${source.slice(0, 80)}...`;
}

function setReplyTarget(message) {
  state.replyTo = message || null;
  if (!state.replyTo) {
    els.replyBar.classList.add("is-hidden");
    return;
  }
  els.replyToName.textContent = state.replyTo.senderUsername || "Unknown";
  els.replyToText.textContent = trimForReply(state.replyTo.text);
  els.replyBar.classList.remove("is-hidden");
}

function activeChat() {
  return chatById(state.activeChatId);
}

function clearActionErrors() {
  els.directError.textContent = "";
  els.contactError.textContent = "";
  els.groupError.textContent = "";
}

function setActionMode(mode) {
  state.actionMode = mode;
  els.directActionForm.classList.toggle("is-hidden", mode !== "direct");
  els.contactActionForm.classList.toggle("is-hidden", mode !== "contact");
  els.groupActionForm.classList.toggle("is-hidden", mode !== "group");
  if (mode === "direct") {
    els.actionModalTitle.textContent = "Start New Chat";
  } else if (mode === "contact") {
    els.actionModalTitle.textContent = "Add Contact";
  } else {
    els.actionModalTitle.textContent = "Create Group";
  }
  clearActionErrors();
}

function openActionModal(mode = "direct") {
  setActionMode(mode);
  els.actionModal.classList.remove("is-hidden");
  if (mode === "direct") {
    els.directTargetInput.focus();
  } else if (mode === "contact") {
    els.contactFullName.focus();
  } else {
    els.groupNameInput.focus();
  }
}

function closeActionModal() {
  els.actionModal.classList.add("is-hidden");
  resetActionForms();
}

function resetActionForms() {
  els.directActionForm.reset();
  els.contactActionForm.reset();
  els.groupActionForm.reset();
  clearActionErrors();
}

function prefillContactForm(prefill = {}) {
  els.contactFullName.value = String(prefill.fullName || "");
  els.contactPhone.value = String(prefill.phone || "");
  els.contactEmail.value = String(prefill.email || "");
  els.contactUsername.value = String(prefill.username || "");
}

async function request(path, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: { ...(options.headers || {}) },
    credentials: "include"
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, config);
  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid server response." }));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function isPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch (_error) {
    return false;
  }
}

function renderLiveAppUrl(url, isPublic = false) {
  if (!els.liveAppUrl || !els.openLiveUrlLink || !els.liveUrlHint) return;
  const safeUrl = String(url || window.location.origin || "").trim();
  if (!safeUrl) return;
  els.liveAppUrl.value = safeUrl;
  els.openLiveUrlLink.href = safeUrl;
  els.liveUrlHint.textContent = isPublic
    ? "Share this live link with people to open the app."
    : "This is a local preview link. Set APP_PUBLIC_URL on the server to show your public live URL.";
}

async function loadLiveAppUrl() {
  const fallbackUrl = window.location.origin;
  renderLiveAppUrl(fallbackUrl, isPublicUrl(fallbackUrl));
  try {
    const payload = await request("/api/public-info");
    if (!payload || !payload.appUrl) return;
    renderLiveAppUrl(payload.appUrl, !!payload.isPublic);
  } catch (_error) {
    // keep fallback URL when API is unavailable
  }
}

async function copyLiveAppUrl() {
  if (!els.liveAppUrl || !els.liveUrlHint) return;
  const url = String(els.liveAppUrl.value || "").trim();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    els.liveUrlHint.textContent = "Live link copied.";
  } catch (_error) {
    els.liveAppUrl.focus();
    els.liveAppUrl.select();
    els.liveUrlHint.textContent = "Press Ctrl+C to copy the live link.";
  }
}

function resetAuthFlow() {
  state.pendingPhone = "";
  if (els.phoneInput) {
    els.phoneInput.disabled = false;
    els.phoneInput.value = "";
  }
  if (els.otpInput) {
    els.otpInput.value = "";
  }
  if (els.otpForm) {
    els.otpForm.classList.add("is-hidden");
  }
  if (els.phoneAuthForm) {
    els.phoneAuthForm.classList.remove("is-hidden");
  }
  if (els.authHint) {
    els.authHint.textContent = "";
  }
  els.authError.textContent = "";
}

function openApp() {
  els.authScreen.classList.add("is-hidden");
  els.appShell.classList.remove("is-hidden");
}

function closeApp() {
  els.appShell.classList.add("is-hidden");
  els.authScreen.classList.remove("is-hidden");
}

function applyAppearance() {
  if (!state.me) return;
  const settings = state.me.settings || {};
  const stored = String(settings.accentColor || "").toLowerCase();
  const accent = stored && !["#050505", "#000000", "#00a884"].includes(stored) ? settings.accentColor : "#d4af37";
  const fontScale = Number(settings.fontScale || 100);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-hot", "#c1121f");
  document.documentElement.style.setProperty("--font-scale", `${fontScale}%`);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", "#0d0d0d");
  }
}

function lockRequired() {
  return !!(state.me && state.me.settings && state.me.settings.appLockEnabled);
}

function updateLockOverlay() {
  const locked = lockRequired() && !state.unlocked;
  els.lockOverlay.classList.toggle("is-hidden", !locked);
  if (locked) {
    els.unlockPin.focus();
  } else {
    els.unlockError.textContent = "";
    els.unlockPin.value = "";
  }
}

function setStatusMessage(message, isError = false) {
  els.settingsStatus.textContent = message;
  els.settingsStatus.style.color = isError ? "var(--danger)" : "var(--text-soft)";
}

function chatById(chatId) {
  return state.chats.find((chat) => chat.id === chatId) || null;
}

function visibleChats() {
  const query = state.chatSearch.trim().toLowerCase();
  return state.chats.filter((chat) => {
    if (state.chatFilter === "unread" && chat.unreadCount <= 0) {
      return false;
    }
    if (state.chatFilter === "groups" && chat.type !== "group") {
      return false;
    }
    if (state.chatFilter === "favorites" && !(chat.prefs && chat.prefs.favorite)) {
      return false;
    }
    if (!query) return true;
    const preview = chat.lastMessage ? chat.lastMessage.text : "";
    return (
      chat.name.toLowerCase().includes(query) ||
      String(preview || "").toLowerCase().includes(query)
    );
  });
}

function visibleDirectoryUsers() {
  const query = state.chatSearch.trim().toLowerCase();
  const users = state.directoryUsers || [];
  if (!query) return users;
  return users.filter((user) => {
    const haystack = [
      user.username,
      user.fullName,
      user.phone,
      user.email
    ].map((value) => String(value || "").toLowerCase());
    return haystack.some((value) => value.includes(query));
  });
}

function renderFilterChips() {
  els.filterChips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.filter === state.chatFilter);
  });
}

function renderNavRail() {
  els.navChatsButton.classList.toggle("is-active", state.sidebarView === "chats");
  els.navContactsButton.classList.toggle("is-active", state.sidebarView === "contacts");
  els.navGroupsButton.classList.toggle("is-active", state.sidebarView === "groups");
}

function renderSidebarChrome() {
  const isChats = state.sidebarView === "chats";
  const isContacts = state.sidebarView === "contacts";
  const isGroups = state.sidebarView === "groups";
  els.filterChips.forEach((chip) => {
    chip.parentElement.classList.toggle("is-hidden", !isChats);
  });
  els.directoryTools.classList.toggle("is-hidden", !isContacts);
  if (isChats) {
    els.sidebarTitle.textContent = "Chats";
    els.sidebarSubtitle.textContent = "Recent conversations";
    els.chatSearchInput.placeholder = "Search or start new chat";
  } else if (isContacts) {
    els.sidebarTitle.textContent = "Contacts";
    els.sidebarSubtitle.textContent = "Find people and start chats";
    els.chatSearchInput.placeholder = "Search contacts";
  } else if (isGroups) {
    els.sidebarTitle.textContent = "Groups";
    els.sidebarSubtitle.textContent = "Your group conversations";
    els.chatSearchInput.placeholder = "Search groups";
  }
  renderNavRail();
}

function renderDirectoryList() {
  const users = visibleDirectoryUsers();
  if (!users.length) {
    els.chatList.innerHTML = '<li class="chat-item"><div class="chat-main"><p class="chat-preview">No contacts found.</p></div></li>';
    return;
  }
  const html = users
    .map((user) => {
      const phone = user.phone ? `<p class="chat-preview">${escapeHtml(user.phone)}</p>` : '<p class="chat-preview">No phone</p>';
      const online = user.online ? '<span class="online-dot" aria-hidden="true"></span>' : "";
      return `
        <li class="chat-item" data-contact-username="${escapeHtml(user.username)}">
          <div class="chat-avatar-wrap">
            ${avatarHtml(user.fullName || user.username)}
            ${online}
          </div>
          <div class="chat-main">
            <div class="chat-row-top">
              <p class="chat-title">${escapeHtml(user.fullName || user.username)}</p>
              <span class="chat-time">${escapeHtml(user.username)}</span>
            </div>
            <div class="chat-row-bottom">
              ${phone}
            </div>
          </div>
        </li>
      `;
    })
    .join("");
  els.chatList.innerHTML = html;
}

function renderChatList() {
  if (state.sidebarView === "contacts") {
    renderDirectoryList();
    return;
  }
  let chats = visibleChats();
  if (state.sidebarView === "groups") {
    chats = chats.filter((chat) => chat.type === "group");
  }
  if (!chats.length) {
    const emptyText = state.sidebarView === "groups"
      ? "No groups yet. Create one in Contacts."
      : "No chats in this filter.";
    els.chatList.innerHTML = `<li class="chat-item"><div class="chat-main"><p class="chat-preview">${escapeHtml(emptyText)}</p></div></li>`;
    return;
  }

  const html = chats
    .map((chat) => {
      const activeClass = chat.id === state.activeChatId ? "is-active" : "";
      const preview = formatPreview(chat);
      const unread = chat.unreadCount > 0 ? `<span class="chat-badge">${chat.unreadCount}</span>` : "";
      const time = chat.lastMessage ? formatListDate(chat.lastMessage.createdAt) : "";
      const pinned = chat.prefs && chat.prefs.pinned ? '<span class="chat-flag" title="Pinned">PIN</span>' : "";
      const muted = chat.prefs && chat.prefs.muted ? '<span class="chat-flag" title="Muted">MUTE</span>' : "";
      const online = isChatOnline(chat) ? '<span class="online-dot" aria-hidden="true"></span>' : "";
      return `
        <li class="chat-item ${activeClass}" data-chat-id="${chat.id}">
          <div class="chat-avatar-wrap">
            ${avatarHtml(chat.name)}
            ${online}
          </div>
          <div class="chat-main">
            <div class="chat-row-top">
              <p class="chat-title">${escapeHtml(chat.name)}</p>
              <span class="chat-time ${chat.unreadCount > 0 ? "is-unread" : ""}">${escapeHtml(time)}</span>
            </div>
            <div class="chat-row-bottom">
              <p class="chat-preview">${escapeHtml(preview)}</p>
              <div class="chat-meta">
                ${pinned}
                ${muted}
                ${unread}
              </div>
            </div>
          </div>
        </li>
      `;
    })
    .join("");
  els.chatList.innerHTML = html;
}

function renderConversationHeader() {
  const chat = chatById(state.activeChatId);
  if (!chat) {
    els.activeChatName.textContent = "Select a chat";
    els.activeChatStatus.textContent = "No active conversation";
    els.activeChatAvatar.textContent = "C";
    els.activeChatAvatar.style.background = "#6b7280";
    [els.searchInChatButton, els.favoriteChatButton, els.muteChatButton, els.pinChatButton, els.markReadButton].forEach((button) => {
      button.disabled = true;
      button.classList.remove("is-active");
    });
    return;
  }
  els.activeChatName.textContent = chat.name;
  els.activeChatStatus.textContent = chat.status || "";
  els.activeChatAvatar.textContent = initialsForName(chat.name);
  els.activeChatAvatar.style.background = colorFromText(chat.name);
  [els.searchInChatButton, els.favoriteChatButton, els.muteChatButton, els.pinChatButton, els.markReadButton].forEach((button) => {
    button.disabled = false;
  });
  const prefs = chat.prefs || {};
  els.favoriteChatButton.classList.toggle("is-active", !!prefs.favorite);
  els.muteChatButton.classList.toggle("is-active", !!prefs.muted);
  els.pinChatButton.classList.toggle("is-active", !!prefs.pinned);
}

function renderMessages() {
  const chat = chatById(state.activeChatId);
  if (!chat) {
    els.messageList.innerHTML = `
      <div class="empty-chat">
        <h4>BGWATSAPP Web</h4>
        <p>Select a chat to start messaging.</p>
      </div>
    `;
    return;
  }
  const messages = state.messagesByChat[chat.id] || [];
  if (!messages.length) {
    els.messageList.innerHTML = '<article class="msg"><p class="msg-text">No messages yet.</p></article>';
    return;
  }

  let currentDay = "";
  const messageQuery = state.messageSearchQuery.trim().toLowerCase();
  const parts = [];
  messages.forEach((message) => {
    const day = formatDayLabel(message.createdAt);
    if (day !== currentDay) {
      currentDay = day;
      parts.push(`<div class="message-day">${escapeHtml(day)}</div>`);
    }

    const outgoing = message.senderId === state.me.id;
    const outClass = outgoing ? "out" : "in";
    const senderPart = outgoing ? "" : `<span>${escapeHtml(message.senderUsername)}</span>`;
    const tickPart = messageStatusMarkup(message);
    const replyBlock = message.replyTo
      ? `
        <div class="reply-quote ${outClass}">
          <small>${escapeHtml(message.replyTo.senderUsername || "Unknown")}</small>
          <p>${escapeHtml(trimForReply(message.replyTo.text || ""))}</p>
        </div>
      `
      : "";
    const matched = messageQuery && String(message.text || "").toLowerCase().includes(messageQuery);
    const matchClass = matched ? "is-match" : "";
    parts.push(`
      <article class="msg ${outClass} ${matchClass}" data-msg-id="${message.id}">
        ${replyBlock}
        <p class="msg-text">${escapeHtml(message.text)}</p>
        <div class="msg-meta">
          ${senderPart}
          <span>${escapeHtml(formatShortTime(message.createdAt))}</span>
          ${tickPart}
        </div>
      </article>
    `);
  });

  els.messageList.innerHTML = parts.join("");
  const firstMatch = els.messageList.querySelector(".msg.is-match");
  if (firstMatch) {
    firstMatch.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  els.messageList.scrollTop = els.messageList.scrollHeight;
}

function renderScheduleOptions() {
  const directAndGroup = state.chats.filter((chat) => !chat.prefs.archived);
  const options = directAndGroup
    .map((chat) => `<option value="${chat.id}">${escapeHtml(chat.name)}</option>`)
    .join("");
  els.scheduleChatSelect.innerHTML = options || "<option value=\"\">No chats</option>";
}

function renderScheduledList() {
  if (!state.scheduled.length) {
    els.scheduledList.innerHTML = "";
    return;
  }
  const html = state.scheduled
    .map(
      (item) => `
      <li class="scheduled-item">
        <strong>${escapeHtml(item.chatName)}</strong>
        <span>${escapeHtml(item.text)}</span>
        <small>${escapeHtml(formatListDate(item.runAt))} ${escapeHtml(formatShortTime(item.runAt))}</small>
        <button type="button" data-cancel-scheduled="${item.id}">Cancel</button>
      </li>
    `
    )
    .join("");
  els.scheduledList.innerHTML = html;
}

function renderSettingsValues() {
  if (!state.me) return;
  const settings = state.me.settings;
  els.toggleReadReceipts.checked = !!settings.readReceipts;
  els.toggleTyping.checked = !!settings.typingIndicators;
  els.toggleAutoReply.checked = !!settings.autoReply;
  els.toggleHideOnline.checked = !!settings.hideOnlineStatus;
  els.toggleFreezeLastSeen.checked = !!settings.freezeLastSeen;
  els.toggleAntiDelete.checked = !!settings.antiDelete;
  els.toggleDnd.checked = !!settings.dndMode;
  els.toggleAppLock.checked = !!settings.appLockEnabled;
  const stored = String(settings.accentColor || "").toLowerCase();
  els.accentColorInput.value = stored && !["#050505", "#000000", "#00a884"].includes(stored) ? settings.accentColor : "#d4af37";
  els.fontScaleInput.value = String(settings.fontScale || 100);
  els.customAutoReplyInput.value = settings.customAutoReply || "";
}

async function fetchMe() {
  const response = await fetch("/api/me", { credentials: "include" });
  const payload = await response.json();
  if (!payload || payload.ok !== true) {
    throw new Error("Unable to fetch session.");
  }
  return payload;
}

async function loadChats() {
  const payload = await request("/api/chats");
  state.chats = payload.chats || [];
  if (!chatById(state.activeChatId)) {
    state.activeChatId = state.chats.length ? state.chats[0].id : null;
  }
  renderSidebarChrome();
  renderFilterChips();
  renderChatList();
  renderConversationHeader();
  renderScheduleOptions();
}

async function loadDirectoryUsers() {
  const query = encodeURIComponent(state.chatSearch || "");
  const payload = await request(`/api/users?q=${query}`);
  state.directoryUsers = payload.users || [];
  if (state.sidebarView === "contacts") {
    renderChatList();
  }
}

async function loadMessages(chatId, markRead = true) {
  if (!chatId) return;
  const payload = await request(`/api/chats/${chatId}/messages?limit=500`);
  state.messagesByChat[chatId] = payload.messages || [];
  renderMessages();
  if (markRead) {
    await markChatRead(chatId);
  }
}

async function markChatRead(chatId) {
  if (!chatId) return;
  await request(`/api/chats/${chatId}/read`, { method: "POST" });
  await loadChats();
}

async function updateTyping(typing) {
  if (!state.activeChatId || !state.me) return;
  try {
    await request(`/api/chats/${state.activeChatId}/typing`, {
      method: "POST",
      body: { typing: !!typing }
    });
  } catch (_error) {
    // typing updates are best-effort
  }
}

function clearTypingTimer() {
  if (state.typingTimer) {
    clearTimeout(state.typingTimer);
    state.typingTimer = null;
  }
}

function bumpTyping() {
  if (!state.activeChatId || !state.me) return;
  if (!state.typingActive) {
    state.typingActive = true;
    updateTyping(true);
  }
  clearTypingTimer();
  state.typingTimer = setTimeout(() => {
    state.typingActive = false;
    updateTyping(false);
  }, 1200);
}

async function loadScheduled() {
  const payload = await request("/api/scheduled");
  state.scheduled = payload.items || [];
  renderScheduledList();
}

async function refreshEverything() {
  if (!state.me) return;
  await loadChats();
  if (state.sidebarView === "contacts") {
    await loadDirectoryUsers();
  }
  if (state.activeChatId) {
    await loadMessages(state.activeChatId, false);
  } else {
    renderMessages();
  }
  await loadScheduled();
}

function scheduleRefresh() {
  if (state.refreshTimer) return;
  state.refreshTimer = setTimeout(async () => {
    state.refreshTimer = null;
    try {
      await refreshEverything();
    } catch (error) {
      setStatusMessage(error.message, true);
    }
  }, 180);
}

function connectRealtimeStream() {
  if (state.stream) {
    state.stream.close();
  }
  const stream = new EventSource("/api/stream");
  state.stream = stream;
  stream.addEventListener("update", () => {
    scheduleRefresh();
  });
  stream.addEventListener("error", () => {
    setTimeout(() => {
      if (state.me) {
        connectRealtimeStream();
      }
    }, 1200);
  });
}

async function enterSession(user) {
  state.me = user;
  state.messagesByChat = {};
  state.chatSearch = "";
  state.sidebarView = "chats";
  state.directoryUsers = [];
  state.messageSearchQuery = "";
  state.replyTo = null;
  state.typingActive = false;
  clearTypingTimer();
  state.unlocked = !lockRequired();
  applyAppearance();
  const displayName = userDisplayName(user);
  els.meUsername.textContent = displayName;
  els.mePersonInfo.textContent = profileDetailsLine(user);
  els.meAvatar.textContent = initialsForName(displayName);
  els.meAvatar.style.background = colorFromText(displayName);
  els.chatSearchInput.value = "";
  setReplyTarget(null);
  openApp();
  await refreshEverything();
  connectRealtimeStream();
  renderSettingsValues();
  updateLockOverlay();
  els.scheduleTimeInput.value = defaultScheduleTimeValue();
}

async function requestPhoneCode(event) {
  event.preventDefault();
  const phone = String(els.phoneInput.value || "").trim();
  els.authError.textContent = "";
  if (els.authHint) {
    els.authHint.textContent = "";
  }
  if (!phone) {
    els.authError.textContent = "Enter your phone number.";
    return;
  }

  try {
    const payload = await request("/api/auth/request-code", {
      method: "POST",
      body: { phone }
    });
    state.pendingPhone = payload.phone || phone;
    els.phoneInput.value = state.pendingPhone;
    els.phoneInput.disabled = true;
    els.otpForm.classList.remove("is-hidden");
    els.otpInput.value = "";
    els.otpInput.focus();
    if (els.authHint) {
      let hint = `Code sent to ${state.pendingPhone}.`;
      if (payload.devCode) {
        hint = `${hint} Demo code: ${payload.devCode}`;
      }
      els.authHint.textContent = hint;
    }
  } catch (error) {
    els.authError.textContent = error.message;
  }
}

async function verifyPhoneCode(event) {
  event.preventDefault();
  const phone = state.pendingPhone || String(els.phoneInput.value || "").trim();
  const code = String(els.otpInput.value || "").trim();
  els.authError.textContent = "";
  if (!phone || !code) {
    els.authError.textContent = "Phone and code are required.";
    return;
  }
  try {
    const payload = await request("/api/auth/verify-code", {
      method: "POST",
      body: { phone, code }
    });
    resetAuthFlow();
    await enterSession(payload.user);
  } catch (error) {
    els.authError.textContent = error.message;
  }
}

function changePhoneNumber() {
  state.pendingPhone = "";
  els.phoneInput.disabled = false;
  els.otpInput.value = "";
  els.otpForm.classList.add("is-hidden");
  if (els.authHint) {
    els.authHint.textContent = "";
  }
  els.authError.textContent = "";
  els.phoneInput.focus();
}

function openConversationMobile() {
  if (window.innerWidth <= 980) {
    document.body.classList.add("mobile-chat-open");
  }
}

async function openChat(chatId) {
  if (state.typingActive && state.activeChatId && state.activeChatId !== chatId) {
    clearTypingTimer();
    state.typingActive = false;
    updateTyping(false);
  }
  state.activeChatId = chatId;
  state.messageSearchQuery = "";
  setReplyTarget(null);
  renderChatList();
  renderConversationHeader();
  await loadMessages(chatId);
  openConversationMobile();
}

async function sendCurrentMessage(event) {
  event.preventDefault();
  if (!state.me) return;
  if (!state.activeChatId) {
    setStatusMessage("Create or select a chat first.", true);
    return;
  }
  if (lockRequired() && !state.unlocked) return;
  const text = els.messageInput.value.trim();
  if (!text) return;

  try {
    await request(`/api/chats/${state.activeChatId}/messages`, {
      method: "POST",
      body: {
        text,
        replyToId: state.replyTo ? state.replyTo.id : null
      }
    });
    clearTypingTimer();
    state.typingActive = false;
    updateTyping(false);
    setReplyTarget(null);
    els.messageInput.value = "";
    await loadMessages(state.activeChatId, false);
    await loadChats();
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

function guessContactDefaults(targetInput) {
  const raw = String(targetInput || "").trim();
  const isEmail = raw.includes("@");
  const hasDigits = /\d/.test(raw);
  return {
    username: !isEmail && !hasDigits ? raw : "",
    email: isEmail ? raw : "",
    phone: !isEmail && hasDigits ? raw : "",
    fullName: ""
  };
}

async function createContactAndChat(input, errorTarget = null) {
  const payloadBody = {
    fullName: String(input.fullName || "").trim(),
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    username: String(input.username || "").trim()
  };

  if (!payloadBody.fullName) {
    if (errorTarget) {
      errorTarget.textContent = "Contact full name is required.";
      return false;
    }
    setStatusMessage("Contact full name is required.", true);
    return false;
  }
  if (lockRequired() && !state.unlocked) return false;

  try {
    const payload = await request("/api/contacts", {
      method: "POST",
      body: payloadBody
    });
    const actionText = payload.created === false ? "linked" : "created";
    setStatusMessage(`Contact ${payload.user.fullName} ${actionText}.`);
    await loadChats();
    await openChat(payload.chat.id);
    closeActionModal();
    return true;
  } catch (error) {
    if (errorTarget) {
      errorTarget.textContent = error.message;
      return false;
    }
    setStatusMessage(error.message, true);
    return false;
  }
}

function quickAddContactAndChat(prefill = {}) {
  if (lockRequired() && !state.unlocked) return;
  prefillContactForm(prefill);
  openActionModal("contact");
}

async function createDirectChatByTarget(target, errorTarget = null) {
  const value = String(target || "").trim();
  if (!value) {
    if (errorTarget) {
      errorTarget.textContent = "Enter username, phone, or email.";
      return false;
    }
    setStatusMessage("Enter username, phone, or email.", true);
    return false;
  }
  if (lockRequired() && !state.unlocked) return false;

  try {
    const payload = await request("/api/chats", {
      method: "POST",
      body: { type: "direct", target: value }
    });
    await loadChats();
    await openChat(payload.chat.id);
    closeActionModal();
    return true;
  } catch (error) {
    if (String(error.message || "").includes("Target user not found")) {
      prefillContactForm(guessContactDefaults(value));
      setActionMode("contact");
      if (errorTarget) {
        errorTarget.textContent = "No account found. Add contact details below.";
      }
      return false;
    }
    if (errorTarget) {
      errorTarget.textContent = error.message;
      return false;
    }
    setStatusMessage(error.message, true);
    return false;
  }
}

async function createDirectChat() {
  if (lockRequired() && !state.unlocked) return;
  els.directTargetInput.value = "";
  openActionModal("direct");
}

async function createGroupChatFromInput(nameValue, membersValue, errorTarget = null) {
  const groupName = String(nameValue || "").trim();
  const members = String(membersValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!groupName) {
    if (errorTarget) {
      errorTarget.textContent = "Group name is required.";
      return false;
    }
    setStatusMessage("Group name is required.", true);
    return false;
  }
  if (lockRequired() && !state.unlocked) return false;

  try {
    const payload = await request("/api/chats", {
      method: "POST",
      body: { type: "group", name: groupName, memberUsernames: members }
    });
    await loadChats();
    await openChat(payload.chat.id);
    closeActionModal();
    return true;
  } catch (error) {
    if (errorTarget) {
      errorTarget.textContent = error.message;
      return false;
    }
    setStatusMessage(error.message, true);
    return false;
  }
}

async function createGroupChat() {
  if (lockRequired() && !state.unlocked) return;
  els.groupNameInput.value = "";
  els.groupMembersInput.value = "";
  openActionModal("group");
}

async function setSidebarView(view) {
  state.sidebarView = view;
  state.chatSearch = "";
  els.chatSearchInput.value = "";
  renderSidebarChrome();
  if (view === "contacts") {
    await loadDirectoryUsers();
    return;
  }
  renderChatList();
}

async function toggleActiveChatPref(prefKey) {
  const chat = activeChat();
  if (!chat || !chat.prefs) return;
  try {
    await request(`/api/chat-prefs/${chat.id}`, {
      method: "PUT",
      body: {
        [prefKey]: !chat.prefs[prefKey]
      }
    });
    await loadChats();
    await loadMessages(chat.id, false);
    renderConversationHeader();
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

function searchInConversation() {
  if (!state.activeChatId) return;
  const current = state.messageSearchQuery || "";
  const input = window.prompt("Search messages in this chat:", current);
  if (input === null) return;
  state.messageSearchQuery = String(input || "").trim();
  renderMessages();
}

async function updateSettings(patch) {
  if (!state.me) return;
  try {
    const payload = await request("/api/settings", {
      method: "PUT",
      body: patch
    });
    state.me.settings = payload.settings;
    applyAppearance();
    renderSettingsValues();
    state.unlocked = !lockRequired();
    updateLockOverlay();
    setStatusMessage("Settings updated.");
    await loadChats();
    renderConversationHeader();
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

async function sendBroadcast() {
  if (lockRequired() && !state.unlocked) return;
  const text = els.broadcastInput.value.trim();
  if (!text) {
    setStatusMessage("Type a broadcast message first.", true);
    return;
  }
  try {
    const payload = await request("/api/broadcast", {
      method: "POST",
      body: { text }
    });
    setStatusMessage(`Broadcast sent to ${payload.count} direct chats.`);
    els.broadcastInput.value = "";
    await refreshEverything();
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

async function scheduleMessage() {
  if (lockRequired() && !state.unlocked) return;
  const chatId = els.scheduleChatSelect.value;
  const text = els.scheduleTextInput.value.trim();
  const runAt = Date.parse(els.scheduleTimeInput.value);
  if (!chatId || !text || Number.isNaN(runAt)) {
    setStatusMessage("Chat, text and time are required for scheduling.", true);
    return;
  }
  try {
    await request("/api/scheduled", {
      method: "POST",
      body: {
        chatId,
        text,
        runAt
      }
    });
    els.scheduleTextInput.value = "";
    els.scheduleTimeInput.value = defaultScheduleTimeValue();
    setStatusMessage("Scheduled message created.");
    await loadScheduled();
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

async function cancelScheduled(id) {
  try {
    await request(`/api/scheduled/${id}`, { method: "DELETE" });
    await loadScheduled();
    setStatusMessage("Scheduled message canceled.");
  } catch (error) {
    setStatusMessage(error.message, true);
  }
}

async function doLogout() {
  clearTypingTimer();
  if (state.typingActive) {
    state.typingActive = false;
    updateTyping(false);
  }
  try {
    await request("/api/logout", { method: "POST" });
  } catch (_error) {
    // ignore logout network errors and reset locally
  }
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
  state.me = null;
  state.chats = [];
  state.messagesByChat = {};
  state.activeChatId = null;
  state.chatFilter = "all";
  state.chatSearch = "";
  state.sidebarView = "chats";
  state.directoryUsers = [];
  state.scheduled = [];
  state.replyTo = null;
  state.messageSearchQuery = "";
  state.pendingPhone = "";
  closeActionModal();
  els.mePersonInfo.textContent = "";
  els.chatSearchInput.value = "";
  closeApp();
  resetAuthFlow();
}

async function unlockApp(event) {
  event.preventDefault();
  const pin = els.unlockPin.value.trim();
  if (!pin) {
    els.unlockError.textContent = "PIN is required.";
    return;
  }
  try {
    await request("/api/unlock", {
      method: "POST",
      body: { pin }
    });
    state.unlocked = true;
    updateLockOverlay();
  } catch (error) {
    els.unlockError.textContent = error.message;
  }
}

function bindEvents() {
  els.phoneAuthForm.addEventListener("submit", requestPhoneCode);
  els.otpForm.addEventListener("submit", verifyPhoneCode);
  els.changePhoneButton.addEventListener("click", changePhoneNumber);
  els.copyLiveUrlButton.addEventListener("click", copyLiveAppUrl);
  els.otpInput.addEventListener("input", () => {
    els.otpInput.value = els.otpInput.value.replace(/[^\d]/g, "").slice(0, 6);
    els.authError.textContent = "";
  });

  els.navLogoutButton.addEventListener("click", doLogout);
  els.navSettingsButton.addEventListener("click", () => {
    els.settingsDrawer.classList.remove("is-hidden");
    renderSettingsValues();
  });
  els.navChatsButton.addEventListener("click", async () => {
    await setSidebarView("chats");
  });
  els.navContactsButton.addEventListener("click", async () => {
    await setSidebarView("contacts");
  });
  els.navGroupsButton.addEventListener("click", async () => {
    await setSidebarView("groups");
  });
  els.openContactCreateButton.addEventListener("click", () => quickAddContactAndChat());
  els.openGroupCreateButton.addEventListener("click", createGroupChat);
  els.actionCloseButton.addEventListener("click", closeActionModal);
  els.actionModal.addEventListener("click", (event) => {
    if (event.target === els.actionModal) {
      closeActionModal();
    }
  });
  els.directOpenContactButton.addEventListener("click", () => {
    const defaults = guessContactDefaults(els.directTargetInput.value);
    prefillContactForm(defaults);
    setActionMode("contact");
  });
  els.contactBackButton.addEventListener("click", () => {
    setActionMode("direct");
  });
  els.directActionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createDirectChatByTarget(els.directTargetInput.value, els.directError);
  });
  els.contactActionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createContactAndChat(
      {
        fullName: els.contactFullName.value,
        phone: els.contactPhone.value,
        email: els.contactEmail.value,
        username: els.contactUsername.value
      },
      els.contactError
    );
  });
  els.groupActionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createGroupChatFromInput(els.groupNameInput.value, els.groupMembersInput.value, els.groupError);
  });
  els.closeSettingsButton.addEventListener("click", () => {
    els.settingsDrawer.classList.add("is-hidden");
  });
  els.chatSearchInput.addEventListener("input", async () => {
    state.chatSearch = els.chatSearchInput.value;
    if (state.sidebarView === "contacts") {
      try {
        await loadDirectoryUsers();
      } catch (error) {
        setStatusMessage(error.message, true);
      }
      return;
    }
    renderChatList();
  });
  els.filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.chatFilter = chip.dataset.filter || "all";
      renderFilterChips();
      renderChatList();
    });
  });

  els.chatList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-chat-id]");
    if (item) {
      openChat(item.dataset.chatId);
      return;
    }
    const contactRow = event.target.closest("[data-contact-username]");
    if (contactRow) {
      createDirectChatByTarget(contactRow.dataset.contactUsername);
    }
  });

  els.searchInChatButton.addEventListener("click", searchInConversation);
  els.favoriteChatButton.addEventListener("click", () => toggleActiveChatPref("favorite"));
  els.muteChatButton.addEventListener("click", () => toggleActiveChatPref("muted"));
  els.pinChatButton.addEventListener("click", () => toggleActiveChatPref("pinned"));
  els.cancelReplyButton.addEventListener("click", () => setReplyTarget(null));

  els.messageList.addEventListener("click", (event) => {
    const bubble = event.target.closest("[data-msg-id]");
    if (!bubble) return;
    const chat = activeChat();
    if (!chat) return;
    const messages = state.messagesByChat[chat.id] || [];
    const selected = messages.find((item) => item.id === bubble.dataset.msgId);
    if (!selected) return;
    setReplyTarget(selected);
    els.messageInput.focus();
  });

  els.messageForm.addEventListener("submit", sendCurrentMessage);
  els.messageInput.addEventListener("input", () => {
    if (!els.messageInput.value.trim()) {
      clearTypingTimer();
      if (state.typingActive) {
        state.typingActive = false;
        updateTyping(false);
      }
      return;
    }
    bumpTyping();
  });
  els.messageInput.addEventListener("blur", () => {
    clearTypingTimer();
    if (state.typingActive) {
      state.typingActive = false;
      updateTyping(false);
    }
  });
  els.markReadButton.addEventListener("click", async () => {
    if (!state.activeChatId) return;
    await markChatRead(state.activeChatId);
  });
  els.mobileBackButton.addEventListener("click", () => {
    document.body.classList.remove("mobile-chat-open");
  });

  els.toggleReadReceipts.addEventListener("change", () => updateSettings({ readReceipts: els.toggleReadReceipts.checked }));
  els.toggleTyping.addEventListener("change", () => updateSettings({ typingIndicators: els.toggleTyping.checked }));
  els.toggleAutoReply.addEventListener("change", () => updateSettings({ autoReply: els.toggleAutoReply.checked }));
  els.toggleHideOnline.addEventListener("change", () => updateSettings({ hideOnlineStatus: els.toggleHideOnline.checked }));
  els.toggleFreezeLastSeen.addEventListener("change", () => updateSettings({ freezeLastSeen: els.toggleFreezeLastSeen.checked }));
  els.toggleAntiDelete.addEventListener("change", () => updateSettings({ antiDelete: els.toggleAntiDelete.checked }));
  els.toggleDnd.addEventListener("change", () => updateSettings({ dndMode: els.toggleDnd.checked }));
  els.toggleAppLock.addEventListener("change", () => {
    updateSettings({ appLockEnabled: els.toggleAppLock.checked });
    if (els.toggleAppLock.checked) {
      state.unlocked = false;
      updateLockOverlay();
    }
  });

  els.accentColorInput.addEventListener("input", () => updateSettings({ accentColor: els.accentColorInput.value }));
  els.fontScaleInput.addEventListener("input", () => updateSettings({ fontScale: Number(els.fontScaleInput.value) }));
  els.customAutoReplyInput.addEventListener("blur", () => updateSettings({ customAutoReply: els.customAutoReplyInput.value }));
  els.appLockPinInput.addEventListener("blur", () => updateSettings({ appLockPin: els.appLockPinInput.value }));

  els.broadcastButton.addEventListener("click", sendBroadcast);
  els.scheduleButton.addEventListener("click", scheduleMessage);
  els.scheduledList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cancel-scheduled]");
    if (!button) return;
    cancelScheduled(button.dataset.cancelScheduled);
  });

  els.unlockForm.addEventListener("submit", unlockApp);
  els.unlockPin.addEventListener("input", () => {
    els.unlockPin.value = els.unlockPin.value.replace(/[^\d]/g, "").slice(0, 4);
    els.unlockError.textContent = "";
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!lockRequired() || state.unlocked) return;
      if (event.target.closest("#lockOverlay")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      document.body.classList.remove("mobile-chat-open");
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.actionModal.classList.contains("is-hidden")) {
      closeActionModal();
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    let hasRefreshed = false;
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => {});
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            installing.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hasRefreshed) return;
        hasRefreshed = true;
        window.location.reload();
      });
    }).catch(() => {});
  }
}

async function bootstrap() {
  bindEvents();
  registerServiceWorker();
  resetAuthFlow();
  await loadLiveAppUrl();
  els.scheduleTimeInput.value = defaultScheduleTimeValue();

  try {
    const payload = await fetchMe();
    if (!payload.authenticated) {
      closeApp();
      resetAuthFlow();
      return;
    }
    await enterSession(payload.user);
  } catch (_error) {
    closeApp();
    resetAuthFlow();
  }
}

bootstrap();
