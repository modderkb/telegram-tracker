// ==========================================
// TELEGRAM JOIN / LEAVE TRACKER
// Firebase FREE - Node.js
// ==========================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = "7142188619";

const http = require("http");

// Render port
const PORT = process.env.PORT || 10000;

// Telegram API
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ==========================================
// BASIC CHECK
// ==========================================

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN environment variable missing!");
    process.exit(1);
}

// ==========================================
// MEMORY STORAGE
// ==========================================

let stats = {
    joins: 0,
    leaves: 0,
    lastEvents: []
};

// ==========================================
// TELEGRAM API FUNCTION
// ==========================================

async function telegram(method, data = {}) {
    try {
        const response = await fetch(`${API}/${method}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.ok) {
            console.error("Telegram API error:", result);
            return null;
        }

        return result.result;
    } catch (error) {
        console.error("Telegram request error:", error.message);
        return null;
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(chatId, text) {
    return telegram("sendMessage", {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML"
    });
}

// ==========================================
// USER NAME
// ==========================================

function getUserName(user) {
    if (!user) return "Unknown User";

    let name = "";

    if (user.first_name) {
        name += user.first_name;
    }

    if (user.last_name) {
        name += " " + user.last_name;
    }

    if (!name.trim()) {
        name = user.username
            ? "@" + user.username
            : String(user.id);
    }

    return name.trim();
}

// ==========================================
// SAVE EVENT
// ==========================================

function saveEvent(type, member, chat) {

    const event = {
        type,
        userId: member.id,
        name: getUserName(member),
        username: member.username
            ? "@" + member.username
            : "No username",
        chatId: chat.id,
        chatTitle: chat.title || "Telegram Channel",
        time: new Date().toISOString()
    };

    stats.lastEvents.unshift(event);

    // Keep last 50 events
    if (stats.lastEvents.length > 50) {
        stats.lastEvents.pop();
    }
}

// ==========================================
// JOIN / LEAVE HANDLER
// ==========================================

async function handleMemberUpdate(update) {

    const memberUpdate = update.chat_member;

    if (!memberUpdate) {
        return;
    }

    const chat = memberUpdate.chat;

    const oldStatus = memberUpdate.old_chat_member?.status;
    const newStatus = memberUpdate.new_chat_member?.status;

    const user = memberUpdate.new_chat_member?.user;

    if (!user) {
        return;
    }

    // User joined
    const joined =
        ["left", "kicked"].includes(oldStatus) &&
        ["member", "administrator", "creator"].includes(newStatus);

    // User left
    const left =
        ["member", "administrator", "creator"].includes(oldStatus) &&
        ["left", "kicked"].includes(newStatus);

    if (joined) {

        stats.joins++;

        saveEvent("JOIN", user, chat);

        const username = user.username
            ? `@${user.username}`
            : "No username";

        const message =
`🟢 <b>NEW MEMBER JOINED</b>

👤 Name: ${getUserName(user)}
🔗 Username: ${username}
🆔 User ID: <code>${user.id}</code>

📢 Channel: ${chat.title || "Unknown"}

📊 Total Joins: ${stats.joins}
📉 Total Leaves: ${stats.leaves}`;

        console.log(message.replace(/<[^>]*>/g, ""));

        await sendMessage(ADMIN_ID, message);
    }

    if (left) {

        stats.leaves++;

        saveEvent("LEAVE", user, chat);

        const username = user.username
            ? `@${user.username}`
            : "No username";

        const message =
`🔴 <b>MEMBER LEFT</b>

👤 Name: ${getUserName(user)}
🔗 Username: ${username}
🆔 User ID: <code>${user.id}</code>

📢 Channel: ${chat.title || "Unknown"}

📊 Total Joins: ${stats.joins}
📉 Total Leaves: ${stats.leaves}`;

        console.log(message.replace(/<[^>]*>/g, ""));

        await sendMessage(ADMIN_ID, message);
    }
}

// ==========================================
// COMMAND HANDLER
// ==========================================

async function handleMessage(message) {

    if (!message || !message.text) {
        return;
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // -------------------------------
    // START
    // -------------------------------

    if (text === "/start") {

        await sendMessage(
            chatId,
`🤖 <b>Telegram Join/Leave Tracker</b>

Bot is active.

Available commands:

/stats - View statistics
/recent - Recent join/leave events
/help - Show help

👤 Admin ID:
<code>${ADMIN_ID}</code>`
        );

        return;
    }

    // -------------------------------
    // HELP
    // -------------------------------

    if (text === "/help") {

        await sendMessage(
            chatId,
`ℹ️ <b>Tracker Help</b>

This bot tracks Telegram member join/leave updates.

Commands:

/stats
/recent
/help

The bot must be an administrator in the channel/chat to receive the required member updates.`
        );

        return;
    }

    // -------------------------------
    // STATS
    // -------------------------------

    if (text === "/stats") {

        if (String(chatId) !== ADMIN_ID) {
            await sendMessage(chatId, "⛔ Admin only.");
            return;
        }

        const totalEvents = stats.joins + stats.leaves;

        await sendMessage(
            chatId,
`📊 <b>CHANNEL STATISTICS</b>

🟢 Joins: <b>${stats.joins}</b>
🔴 Leaves: <b>${stats.leaves}</b>
📋 Events: <b>${totalEvents}</b>

🤖 Bot Status: <b>ONLINE</b>`
        );

        return;
    }

    // -------------------------------
    // RECENT EVENTS
    // -------------------------------

    if (text === "/recent") {

        if (String(chatId) !== ADMIN_ID) {
            await sendMessage(chatId, "⛔ Admin only.");
            return;
        }

        if (stats.lastEvents.length === 0) {
            await sendMessage(chatId, "📭 No join/leave events recorded yet.");
            return;
        }

        let output = "📋 <b>RECENT EVENTS</b>\n\n";

        stats.lastEvents.slice(0, 10).forEach((event, index) => {

            const icon = event.type === "JOIN"
                ? "🟢"
                : "🔴";

            const time = new Date(event.time).toLocaleString(
                "en-IN",
                {
                    timeZone: "Asia/Kolkata"
                }
            );

            output +=
`${index + 1}. ${icon} <b>${event.type}</b>
👤 ${event.name}
🆔 <code>${event.userId}</code>
🕐 ${time}

`;
        });

        await sendMessage(chatId, output);

        return;
    }
}

// ==========================================
// UPDATE PROCESSOR
// ==========================================

async function processUpdate(update) {

    try {

        // Member join/leave
        if (update.chat_member) {
            await handleMemberUpdate(update);
        }

        // Bot commands
        if (update.message) {
            await handleMessage(update.message);
        }

    } catch (error) {
        console.error("Update processing error:", error);
    }
}

// ==========================================
// TELEGRAM POLLING
// ==========================================

let offset = 0;
let polling = true;

async function startPolling() {

    console.log("🤖 Telegram Join/Leave Tracker starting...");

    // Remove old webhook
    await telegram("deleteWebhook", {
        drop_pending_updates: false
    });

    // Check bot
    const botInfo = await telegram("getMe");

    if (!botInfo) {
        console.error("❌ Unable to connect to Telegram.");
        return;
    }

    console.log(
        `✅ Bot connected: @${botInfo.username}`
    );

    while (polling) {

        try {

            const updates = await telegram("getUpdates", {
                offset,
                timeout: 30,
                allowed_updates: [
                    "message",
                    "chat_member"
                ]
            });

            if (!updates) {
                await new Promise(resolve =>
                    setTimeout(resolve, 3000)
                );

                continue;
            }

            for (const update of updates) {

                offset = update.update_id + 1;

                await processUpdate(update);
            }

        } catch (error) {

            console.error(
                "Polling error:",
                error.message
            );

            await new Promise(resolve =>
                setTimeout(resolve, 5000)
            );
        }
    }
}

// ==========================================
// RENDER WEB SERVER
// ==========================================

const server = http.createServer((req, res) => {

    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end(
        "Telegram Join/Leave Tracker is running."
    );
});

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🌐 Web server running on port ${PORT}`
    );

    startPolling();
});

// ==========================================
// ERROR HANDLING
// ==========================================

process.on("uncaughtException", error => {
    console.error("❌ Uncaught Exception:", error);
});

process.on("unhandledRejection", error => {
    console.error("❌ Unhandled Rejection:", error);
});

// ==========================================
// SHUTDOWN
// ==========================================

process.on("SIGTERM", () => {

    console.log("Stopping bot...");

    polling = false;

    server.close(() => {
        process.exit(0);
    });
});
