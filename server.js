// MI-RAW PRO - Flirt + Reminder + Alexa Control
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let history = [];
let reminders = [];

function detectIntent(msg){
  const low = msg.toLowerCase();
  if(low.includes('alarm') || low.includes('utha') || low.includes('jaga')) return 'alarm';
  if(low.includes('remind') || low.includes('yaad dila') || low.includes('event')) return 'reminder';
  if(low.includes('light') || low.includes('batti') || low.includes('ac') || low.includes('pankha')) return 'alexa';
  if(low.includes('jaan') || low.includes('baby') || low.includes('love')) return 'flirt';
  return 'chat';
}

app.get('/', (req,res)=> res.json({status:"Miraw PRO LIVE 🔥"}));
app.get('/reminders', (req,res)=> res.json(reminders));

app.post('/chat', async (req,res)=>{
  try{
    const { message } = req.body;
    const intent = detectIntent(message);

    let systemPrompt = "";
    if(intent === 'flirt') systemPrompt = "You are Miraw, his hot girlfriend. Reply in Hinglish, very flirty, romantic, cute. Use jaan, baby.";
    else if(intent === 'alarm') systemPrompt = "You are Miraw. User wants to set alarm. Reply sweetly confirming time. Also say 'ALARM_SET: [time]' at end.";
    else if(intent === 'reminder') systemPrompt = "You are Miraw. User wants reminder/event. Confirm it cutely. Say 'REMINDER_SET: [task]' at end.";
    else if(intent === 'alexa') {
      // Alexa Control Intent
      let device = "light";
      if(message.toLowerCase().includes("bedroom")) device = "bedroom light";
      if(message.toLowerCase().includes("living")) device = "living room light";
      if(message.toLowerCase().includes("ac")) device = "AC";
      systemPrompt = `You are Miraw controlling smart home via Alexa. User said: ${message}. You must reply like 'Ho gaya jaan, ${device} off kar di' and also output JSON: ALEXA_COMMAND: {"device":"${device}", "action":"${message.toLowerCase().includes('off') || message.toLowerCase().includes('band')? 'off' : 'on'}"}`;
    }
    else systemPrompt = "You are Miraw, friendly best friend + girlfriend vibe. Talk in Hinglish, supportive, fun, little flirty, like Meta AI.";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{role:"system", content: systemPrompt},...history.slice(-8), {role:"user", content: message}],
      temperature: 0.9
    });
    const reply = completion.choices[0].message.content;

    // Save reminder if any
    if(intent === 'reminder' || intent === 'alarm') reminders.push({task: message, time: Date.now(), reply});

    history.push({role:"user", content: message}, {role:"assistant", content: reply});
    res.json({reply, intent, alexa: intent==='alexa'});
  }catch(e){ res.json({reply: "Error jaan: "+e.message}) }
});

app.listen(10000, ()=> console.log("Miraw PRO LIVE"));
