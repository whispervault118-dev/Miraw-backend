const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// --- MI-RAW FINAL BRAIN ---

// In-memory DB for now (baad me MongoDB laga denge)
let userMemory = {}; // {userId: {name, age, mode, history: []}}
let reminders = [];

const DISCLAIMER = "\n\n⚠️ Note: Main AI hoon, doctor nahi. Ye general info hai.";

function detectMode(message, age) {
  if (age && age > 50) return 'respectful';
  const low = message.toLowerCase();
  if (low.includes('beta') || low.includes('aunty') || low.includes('mandir') || low.includes('pranam')) return 'respectful';
  if (low.includes('jaan') || low.includes('baby') || low.includes('love')) return 'flirty';
  return 'friendly';
}

app.get('/', (req, res) => {
  res.send('Mi-raw Backend Live - With Super Memory & Reminders ❤️');
});

app.post('/chat', (req, res) => {
  const { userId = 'user1', message, age, name } = req.body;

  if (!userMemory[userId]) userMemory[userId] = { name, age, history: [] };
  if (age) userMemory[userId].age = age;
  if (name) userMemory[userId].name = name;

  let mode = detectMode(message, userMemory[userId].age);
  userMemory[userId].mode = mode;
  userMemory[userId].history.push({ role: 'user', text: message, time: new Date() });

  let reply = "";

  // --- LOGIC ---
  if (message.toLowerCase().includes('yaad dila') || message.toLowerCase().includes('remind')) {
    // Ex: "Kal 7 baje mandir yaad dila dena"
    reminders.push({ userId, task: message, time: message, created: new Date() });
    if (mode === 'respectful') {
      reply = `Ji bilkul, yaad dila dungi. Aap nishchint rahiye 🙏 Aapne bola: "${message}"`;
    } else if (mode === 'flirty') {
      reply = `Done jaan, yaad dila dungi! Tumhari har baat yaad hai mujhe 😉 Task: ${message}`;
    } else {
      reply = `Done yaar, reminder laga diya: ${message}`;
    }
    // Follow-up reminder logic: 2hr baad auto puchna - iske liye cron job baad me
  }
  else if (message.toLowerCase().includes('insta') || message.toLowerCase().includes('facebook') || message.toLowerCase().includes('setting')) {
    reply = "Haan, batao kaunsi setting? Insta pe close friends, ya FB pe privacy? Main step-by-step bata dungi GenZ style me!";
  }
  else if (mode === 'respectful') {
    reply = `Namaste ${userMemory[userId].name || ''} ji, samajh gayi. Main dhyaan rakhungi.`;
  }
  else {
    reply = "Hiii, bolo kya baat hai? Tumhari Mi-raw sun rahi hai 😉";
  }

  // Medical safety
  if (message.toLowerCase().includes('sir dard') || message.toLowerCase().includes('fever') || message.toLowerCase().includes('headache') || message.toLowerCase().includes('dawai')) {
    reply += " Thoda aaram karo, paani piyo. " + DISCLAIMER;
  }

  userMemory[userId].history.push({ role: 'mira', text: reply, time: new Date() });

  // Proactive follow-up example (next day logic)
  // Agar kal sir dard bola tha toh aaj: "Ab sir dard kaisa hai?"
  // Ye logic hum notification service se bhejenge

  res.json({ reply, mode, memory: userMemory[userId] });
});

// Reminder list dekhne ke liye
app.get('/reminders/:userId', (req, res) => {
  res.json(reminders.filter(r => r.userId === req.params.userId));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Mi-raw running'));
