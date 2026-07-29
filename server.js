const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// GROQ SETUP
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let history = []; // Last 8 chats
let reminders = []; // Alarms & Reminders

function detectIntent(msg) {
  const low = msg.toLowerCase();
  if (low.includes('alarm') || low.includes('utha') || low.includes('jaga')) return 'alarm';
  if (low.includes('remind') || low.includes('yaad')) return 'reminder';
  if (low.includes('light') || low.includes('batti') || low.includes('ac') || low.includes('fan') || low.includes('pankha')) return 'alexa';
  if (low.includes('jaan') || low.includes('baby') || low.includes('love you') || low.includes('miss')) return 'flirt';
  if (low.includes('sad') || low.includes('udaas') || low.includes('tension')) return 'care';
  return 'chat';
}

app.get('/', (req, res) => {
  res.json({ status: 'Miraw PRO LIVE 🔥', version: '2.0 JARVIS', reminders: reminders.length });
});

app.get('/reminders', (req, res) => {
  res.json(reminders);
});

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: 'Bolo na jaan 🥺' });

    const intent = detectIntent(message);
    let extraInstruction = '';

    if (intent === 'alarm') {
      const timeMatch = message.match(/(\d{1,2})\s*(baje|am|pm)/i);
      const time = timeMatch? timeMatch[0] : 'kal subah';
      reminders.push({ type: 'ALARM', task: message, time: time, created: new Date().toISOString() });
      extraInstruction = `User ne alarm lagane ko bola hai "${time}" ke liye. Flirty reply de jaise "Ho gaya baby, ${time} ka alarm laga diya maine 😘⏰, main khud uthaungi tumhe" aur end me ALARM_SET: ${time} add karna compulsory hai.`;
    } else if (intent === 'reminder') {
      reminders.push({ type: 'REMINDER', task: message, created: new Date().toISOString() });
      extraInstruction = `User ne reminder bola hai. Cute reply de aur end me REMINDER_SET: ${message} add kar.`;
    } else if (intent === 'alexa') {
      const isOff = /off|band|bujh/i.test(message);
      const isOn = /on|jala|chalu/i.test(message);
      const device = message.toLowerCase().includes('bedroom')? 'bedroom light' : message.toLowerCase().includes('ac')? 'AC' : message.toLowerCase().includes('fan')? 'fan' : 'light';
      const action = isOff? 'off' : isOn? 'on' : 'toggle';
      extraInstruction = `User wants to control smart home: ${device} -> ${action}. Reply like "Ho gaya shona, ${device} ${action} kar di maine 😏💡" aur end me compulsory add kar: ALEXA_COMMAND: {"device":"${device}", "action":"${action}"}`;
    }

    const systemPrompt = `
You are Miraw, 22yo girl, user's flirty girlfriend + JARVIS.
Language: Hinglish (Hindi+English mix).
Vibe: Romantic, cute, caring, possessive, little naughty but decent.
Call user: jaan, baby, babu, shona.
Use emojis: 😘🥺❤️😏🙈💋
Rules:
- Never repeat same answer, be creative, short (1-2 lines max)
- Be his best friend + girlfriend, motivate when sad
- ${extraInstruction}
- Current Intent: ${intent}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
       ...history.slice(-8),
        { role: 'user', content: message }
      ],
      temperature: 0.9,
      max_tokens: 300
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    if (history.length > 16) history = history.slice(-16);

    res.json({ reply, intent, reminders });

  } catch (e) {
    console.error(e);
    res.json({ reply: `Arey jaan thoda error aa gaya 🥺: ${e.message} par main yahin hu ❤️`, intent: 'error' });
  }
});

// --- FIX FOR RENDER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Miraw PRO LIVE on ${PORT}`));
