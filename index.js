// ==========================================
// TELEGRAM JOIN / LEAVE TRACKER
// Render + Node.js
// Auto Reconnect Version
// ==========================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = "7142188619";

const http = require("http");

const PORT = process.env.PORT || 10000;
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

const stats = {
    joins: 0,
    leaves: 0,
    lastEvents: []
};

// ==========================================
// HELPERS
// ==========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
// TELEGRAM API
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
            console.error(
                `❌ Telegram API error [${method}]:`,
                result.description || result
            );

            return null;
        }

        return result.result;

    } catch (error) {
        console.error(
            `❌ Telegram request error [${method}]:`,
            error.message
        );

        return null;
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(chatId, text) {
    return telegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML"
    });
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

        chatTitle:
            chat.title ||
            "Telegram Channel",

        time: new Date().toISOString()
    };

    stats.lastEvents.unshift(event);

    if (stats.lastEvents.length > 50) {
        stats.lastEvents.pop();
    }
}

// ==========================================
// JOIN / LEAVE HANDLER
// ==========================================

async function handleMemberUpdate(update) {

    const memberUpdate = update.chat_member;

    if (!memberUpdate) return;

    const chat = memberUpdate.chat;

    const oldStatus =
        memberUpdate.old_chat_member?.status;

    const newStatus =
        memberUpdate.new_chat_member?.status;

    const user =
        memberUpdate.new_chat_member?.user;

    if (!user) return;

    // JOIN
    const joined =
        ["left", "kicked"].includes(oldStatus) &&
        ["member", "administrator", "creator"].includes(newStatus);

    // LEAVE
    const left =
        ["member", "administrator", "creator"].includes(oldStatus) &&
        ["left", "kicked"].includes(newStatus);

    // ======================================
    // JOIN
    // ======================================

    if (joined) {

        stats.joins++;

        saveEvent(
            "JOIN",
            user,
            chat
        );

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

        console.log(
            message.replace(/<[^>]*>/g, "")
        );

        await sendMessage(
            ADMIN_ID,
            message
        );
    }

    // ======================================
    // LEAVE
    // ======================================

    if (left) {

        stats.leaves++;

        saveEvent(
            "LEAVE",
            user,
            chat
        );

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

        console.log(
            message.replace(/<[^>]*>/g, "")
        );

        await sendMessage(
            ADMIN_ID,
            message
        );
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

    // ======================================
    // START
    // ======================================

    if (text === "/start") {

        await sendMessage(
            chatId,
`🤖 <b>Telegram Join/Leave Tracker</b>

✅ Bot is active.

Commands:

/stats - Statistics
/recent - Recent events
/help - Help

👤 Admin ID:
<code>${ADMIN_ID}</code>`
        );

        return;
    }

    // ======================================
    // HELP
    // ======================================

    if (text === "/help") {

        await sendMessage(
            chatId,
`ℹ️ <b>Tracker Help</b>

This bot tracks member join/leave updates.

Commands:

/stats
/recent
/help

⚠️ The bot must be an administrator in the channel/group to receive chat member updates.`
        );

        return;
    }

    // ======================================
    // STATS
    // ======================================

    if (text === "/stats") {

        if (String(chatId) !== ADMIN_ID) {

            await sendMessage(
                chatId,
                "⛔ Admin only."
            );

            return;
        }

        const totalEvents =
            stats.joins +
            stats.leaves;

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

    // ======================================
    // RECENT
    // ======================================

    if (text === "/recent") {

        if (String(chatId) !== ADMIN_ID) {

            await sendMessage(
                chatId,
                "⛔ Admin only."
            );

            return;
        }

        if (stats.lastEvents.length === 0) {

            await sendMessage(
                chatId,
                "📭 No join/leave events recorded yet."
            );

            return;
        }

        let output =
            "📋 <b>RECENT EVENTS</b>\n\n";

        stats.lastEvents
            .slice(0, 10)
            .forEach((event, index) => {

                const icon =
                    event.type === "JOIN"
                        ? "🟢"
                        : "🔴";

                const time =
                    new Date(event.time)
                        .toLocaleString(
                            "en-IN",
                            {
                                timeZone:
                                    "Asia/Kolkata"
                            }
                        );

                output +=
`${index + 1}. ${icon} <b>${event.type}</b>
👤 ${event.name}
🆔 <code>${event.userId}</code>
🕐 ${time}

`;
            });

        await sendMessage(
            chatId,
            output
        );

        return;
    }
}

// ==========================================
// UPDATE PROCESSOR
// ==========================================

async function processUpdate(update) {

    try {

        if (update.chat_member) {
            await handleMemberUpdate(update);
        }

        if (update.message) {
            await handleMessage(update.message);
        }

    } catch (error) {

        console.error(
            "❌ Update processing error:",
            error.message
        );
    }
}

// ==========================================
// TELEGRAM POLLING
// ==========================================

let offset = 0;
let pollingRunning = false;
let stopping = false;

async function pollingLoop() {

    if (pollingRunning) {
        console.log("⚠️ Polling already running.");
        return;
    }

    pollingRunning = true;

    console.log("🔄 Starting Telegram polling...");

    while (!stopping) {

        try {

            const updates = await telegram(
                "getUpdates",
                {
                    offset,
                    timeout: 30,

                    allowed_updates: [
                        "message",
                        "chat_member"
                    ]
                }
            );

            // Telegram request failed
            if (!updates) {

                console.log(
                    "⚠️ Telegram unavailable. Reconnecting in 5 seconds..."
                );

                await sleep(5000);

                continue;
            }

            // Process updates
            for (const update of updates) {

                offset =
                    update.update_id + 1;

                await processUpdate(
                    update
                );
            }

        } catch (error) {

            console.error(
                "❌ Polling error:",
                error.message
            );

            console.log(
                "🔄 Reconnecting in 5 seconds..."
            );

            await sleep(5000);
        }
    }

    pollingRunning = false;
}

// ==========================================
// START BOT
// ==========================================

async function startBot() {

    console.log("");
    console.log("=================================");
    console.log("🤖 TELEGRAM TRACKER STARTING");
    console.log("=================================");

    // Delete webhook first
    const webhookRemoved =
        await telegram(
            "deleteWebhook",
            {
                drop_pending_updates: false
            }
        );

    if (webhookRemoved !== null) {
        console.log("✅ Old webhook removed.");
    }

    // Check bot
    const botInfo =
        await telegram("getMe");

    if (!botInfo) {

        console.error(
            "❌ Could not connect to Telegram."
        );

        console.error(
            "Check BOT_TOKEN in Render Environment Variables."
        );

        return;
    }

    console.log(
        `✅ Bot connected: @${botInfo.username}`
    );

    console.log(
        `🆔 Bot ID: ${botInfo.id}`
    );

    console.log(
        "🔄 Telegram polling started."
    );

    pollingLoop();
}

// ==========================================
// HTTP SERVER
// ==========================================

const server =
    http.createServer(
        (req, res) => {

            // Health check
            if (req.url === "/health") {

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "application/json"
                    }
                );

                res.end(
                    JSON.stringify({
                        status: "ok",
                        bot: "running",
                        time:
                            new Date().toISOString()
                    })
                );

                return;
            }

            res.writeHead(
                200,
                {
                    "Content-Type":
                        "text/html; charset=utf-8"
                }
            );

            res.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Telegram Tracker</title>
<style>
body{
    margin:0;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    font-family:Arial,sans-serif;
    background:#f5f7fb;
}
.card{
    background:white;
    padding:30px;
    border-radius:18px;
    box-shadow:0 10px 30px rgba(0,0,0,.08);
    text-align:center;
    max-width:400px;
    width:90%;
}
.status{
    color:#16a34a;
    font-weight:bold;
    font-size:20px;
}
.small{
    color:#666;
    margin-top:10px;
}
</style>
</head>
<body>
<div class="card">
    <div class="status">🟢 Bot Server Online</div>
    <div class="small">
        Telegram tracker is running.
    </div>
</div>
</body>
</html>
`);
        }
    );

// ==========================================
// SERVER START
// ==========================================

server.listen(
    PORT,
    "0.0.0.0",
    async () => {

        console.log(
            `🌐 Server listening on port ${PORT}`
        );

        await startBot();
    }
);

// ==========================================
// ERROR HANDLING
// ==========================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ Uncaught Exception:",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "❌ Unhandled Rejection:",
            error
        );
    }
);

// ==========================================
// SHUTDOWN
// ==========================================

async function shutdown(signal) {

    console.log(
        `🛑 ${signal} received.`
    );

    stopping = true;

    server.close(() => {

        console.log(
            "🌐 HTTP server stopped."
        );

        process.exit(0);
    });
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);
