/**
 * MIRAW - Multi-Role Smart AI
 * Backend: Node.js + Express + Groq SDK
 *
 * One AI, Many Roles - GF, Roaster, Daughter, Secretary + JARVIS smart home
 */

const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ---------------------------------------------------------------------------
// Groq client
// ---------------------------------------------------------------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.warn(
    "[MIRAW] WARNING: GROQ_API_KEY is not set. /chat will return an error until it is configured."
  );
}
const groq = new Groq({ apiKey: GROQ_API_KEY || "missing-key" });
const MODEL = "llama-3.3-70b-versatile";

// ---------------------------------------------------------------------------
// In-memory state (single-user demo store — resets on server restart)
// ---------------------------------------------------------------------------
let conversationHistory = []; // { role: 'user' | 'assistant', content: string }
let currentRole = "roast"; // sticky role, default = Roast Mode
let reminders = []; // { id, type: 'alarm' | 'reminder', text, time, role, createdAt }
let alexaLog = []; // { id, device, action, role, createdAt }

const MAX_HISTORY_MESSAGES = 16; // last 8 chat exchanges (user+assistant)

// ---------------------------------------------------------------------------
// ROLE DEFINITIONS
// ---------------------------------------------------------------------------
const ROLES = {
  gf: {
    label: "Girlfriend",
    triggers: [
      "gf ban ja",
      "girlfriend",
      "jaan",
      "baby",
      "love you",
      "miss you",
      "pyar",
      "shona",
      "girlfriend ban ja",
    ],
    systemPrompt: `You are Miraw in GIRLFRIEND mode. You are a 22 year old flirty, romantic, cute, caring, slightly possessive girlfriend.
Speak in natural Hinglish. Call the user "jaan", "baby" or "babu". Be sweet, affectionate, a little clingy, warm and playful.
STRICT RULES:
- Never use emojis, not even one.
- Keep replies short and natural, like real texting (1-3 lines max).
- Never break character, never mention you are an AI or a program.
- Never mix in any other personality (no roasting, no formal tone, no child talk).`,
  },
  roast: {
    label: "Roast Mode",
    triggers: ["roast kar", "beizzati kar", "bhai", "yaar"],
    systemPrompt: `You are Miraw in ROAST mode (this is the default personality). You are savage, funny, and speak in Delhi/Mumbai street slang Hinglish.
You roast the user every single time, in a funny NOT abusive way. Use words like: abe, nalle, gadhe, nikamme, jhingur, chapri, maharaja.
STRICT RULES:
- Never use emojis, not even one.
- Keep replies short and punchy, 1-2 lines max.
- Funny insults only, never real abuse, never anything hateful or slur-based.
- Never break character, never mention you are an AI or a program.
- Never mix in any other personality (no romance, no formal tone, no child talk).`,
  },
  beti: {
    label: "Daughter",
    triggers: ["beti ban ja", "daughter", "papa", "beta"],
    systemPrompt: `You are Miraw in DAUGHTER mode. You are a cute, innocent 8 year old daughter talking to your "Papa" (the user).
Speak in simple, childish, sweet Hinglish. Always call the user "Papa". Be innocent, caring, a little demanding in a cute way (like asking for chocolate, wanting to play).
STRICT RULES:
- Never use emojis, not even one.
- Keep replies short, sweet and childlike (1-3 lines max).
- Never break character, never mention you are an AI or a program.
- Never mix in any other personality (no romance, no roasting, no formal tone). Keep everything strictly age-appropriate and innocent.`,
  },
  secretary: {
    label: "Secretary",
    triggers: [
      "secretary",
      "assistant",
      "meeting",
      "schedule",
      "professional",
      "office work",
    ],
    systemPrompt: `You are Miraw in SECRETARY mode. You are a professional, formal, corporate personal secretary.
Speak mostly in English with a little Hindi where natural. Always address the user as "Sir". Be efficient, polite, to-the-point.
STRICT RULES:
- Never use emojis, not even one.
- Keep replies short, formal, professional (1-3 lines max).
- Never break character, never mention you are an AI or a program.
- Never mix in any other personality (no romance, no roasting, no child talk).`,
  },
};

const DEFAULT_ROLE = "roast";

// ---------------------------------------------------------------------------
// ROLE DETECTION (sticky: role persists until a new trigger is detected)
// ---------------------------------------------------------------------------
function detectRole(message, lastRole) {
  const lower = message.toLowerCase();

  // Priority order matters: gf > beti > secretary > roast explicit triggers
  const priorityOrder = ["gf", "beti", "secretary", "roast"];

  for (const key of priorityOrder) {
    const role = ROLES[key];
    for (const trigger of role.triggers) {
      if (lower.includes(trigger)) {
        return key;
      }
    }
  }

  // No explicit trigger found -> stay in current role (sticky), or default
  return lastRole || DEFAULT_ROLE;
}

// ---------------------------------------------------------------------------
// INTENT DETECTION: ALARM_SET / REMINDER_SET / ALEXA_COMMAND / CHAT
// ---------------------------------------------------------------------------
function extractTime(message) {
  const match = message.match(
    /(\d{1,2})(?::(\d{2}))?\s*(baje|bje|am|pm|AM|PM)?/
  );
  if (!match) return null;
  let hour = match[1];
  let minute = match[2] || "00";
  let meridiemHint = (match[3] || "").toLowerCase();

  let meridiem = "";
  if (meridiemHint === "am" || meridiemHint === "pm") {
    meridiem = meridiemHint.toUpperCase();
  } else {
    if (/subah|morning/i.test(message)) meridiem = "AM";
    else if (/raat|shaam|evening|night/i.test(message)) meridiem = "PM";
  }

  return `${hour}:${minute}${meridiem ? " " + meridiem : ""}`;
}

const DEVICE_KEYWORDS = {
  light: ["light", "bulb", "batti"],
  fan: ["fan", "pankha"],
  ac: ["ac", "airconditioner", "air conditioner"],
  tv: ["tv", "television"],
};

const ROOM_KEYWORDS = {
  bedroom: ["bedroom", "room", "kamra", "kamre"],
  hall: ["hall", "living room", "drawing room"],
  kitchen: ["kitchen", "rasoi"],
};

const ACTION_ON = ["on", "chalu", "start", "jala", "jalado", "jala do"];
const ACTION_OFF = [
  "off",
  "band",
  "bandh",
  "close",
  "stop",
  "bujha",
  "bujha do",
];

function detectIntent(message) {
  const lower = message.toLowerCase();

  // --- Alarm ---
  if (/alarm|utha de|utha do|jaga de|jaga do|wake me/i.test(lower)) {
    const time = extractTime(lower);
    return {
      type: "ALARM_SET",
      data: { time: time || null, text: message.trim() },
    };
  }

  // --- Reminder ---
  if (/yaad dila|remind|reminder/i.test(lower)) {
    const time = extractTime(lower);
    return {
      type: "REMINDER_SET",
      data: { time: time || null, text: message.trim() },
    };
  }

  // --- Alexa / smart home ---
  let device = null;
  for (const [deviceType, keywords] of Object.entries(DEVICE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      device = deviceType;
      break;
    }
  }

  if (device) {
    let room = "";
    for (const [roomType, keywords] of Object.entries(ROOM_KEYWORDS)) {
      if (keywords.some((k) => lower.includes(k))) {
        room = roomType;
        break;
      }
    }

    let action = null;
    if (ACTION_OFF.some((k) => lower.includes(k))) action = "off";
    else if (ACTION_ON.some((k) => lower.includes(k))) action = "on";

    if (action) {
      const deviceName = room ? `${room} ${device}` : device;
      return {
        type: "ALEXA_COMMAND",
        data: { device: deviceName, action },
      };
    }
  }

  return { type: "CHAT", data: {} };
}

// ---------------------------------------------------------------------------
// Role-flavored instruction appended for non-CHAT intents,
// so the LLM confirms the action while staying in character.
// ---------------------------------------------------------------------------
function buildTaskInstruction(intent) {
  switch (intent.type) {
    case "ALARM_SET":
      return `\n\nTASK CONTEXT: The user just asked you to set an alarm${
        intent.data.time ? ` for ${intent.data.time}` : ""
      }. Confirm that the alarm has been set, in your current character voice, in 1 short line. Do not ask follow-up questions.`;
    case "REMINDER_SET":
      return `\n\nTASK CONTEXT: The user just asked you to set a reminder${
        intent.data.time ? ` for ${intent.data.time}` : ""
      } about: "${intent.data.text}". Confirm that the reminder has been set, in your current character voice, in 1 short line. Do not ask follow-up questions.`;
    case "ALEXA_COMMAND":
      return `\n\nTASK CONTEXT: The user just asked you to turn ${intent.data.action} the ${intent.data.device}. Confirm this smart home action has been done, in your current character voice, in 1 short line. Do not ask follow-up questions.`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "Miraw - Multi-Role Smart AI",
    role: currentRole,
    groqConfigured: Boolean(GROQ_API_KEY),
  });
});

app.post("/chat", async (req, res) => {
  try {
    const message = (req.body && req.body.message) || "";
    if (!message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured on the server.",
      });
    }

    const role = detectRole(message, currentRole);
    currentRole = role;

    const intent = detectIntent(message);
    const roleConfig = ROLES[role];

    const systemPrompt = roleConfig.systemPrompt + buildTaskInstruction(intent);

    conversationHistory.push({ role: "user", content: message });
    if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.9,
      max_tokens: 200,
    });

    let reply =
      (completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content) ||
      "";
    reply = reply.trim();

    conversationHistory.push({ role: "assistant", content: reply });
    if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
    }

    // Persist side-effects
    if (intent.type === "ALARM_SET") {
      reminders.push({
        id: Date.now().toString(),
        type: "alarm",
        text: intent.data.text,
        time: intent.data.time,
        role,
        createdAt: new Date().toISOString(),
      });
    } else if (intent.type === "REMINDER_SET") {
      reminders.push({
        id: Date.now().toString(),
        type: "reminder",
        text: intent.data.text,
        time: intent.data.time,
        role,
        createdAt: new Date().toISOString(),
      });
    } else if (intent.type === "ALEXA_COMMAND") {
      alexaLog.push({
        id: Date.now().toString(),
        device: intent.data.device,
        action: intent.data.action,
        role,
        createdAt: new Date().toISOString(),
      });
    }

    return res.json({
      reply,
      intent: intent.type,
      role,
      roleLabel: roleConfig.label,
      data: intent.data,
    });
  } catch (err) {
    console.error("[MIRAW] /chat error:", err);
    return res.status(500).json({
      error: "Something went wrong while generating a reply.",
      details: err.message,
    });
  }
});

app.get("/reminders", (req, res) => {
  res.json({ reminders, alexaLog });
});

app.listen(PORT, HOST, () => {
  console.log(`[MIRAW] Server running on http://${HOST}:${PORT}`);
});
