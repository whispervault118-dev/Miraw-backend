const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let history = [];

function detectIntent(msg){
  const low = msg.toLowerCase();
  if(low.includes('alarm') || low.includes('utha')) return 'alarm';
  if(low.includes('remind') || low.includes('yaad')) return 'reminder';
  if(low.includes('light') || low.includes('batti') || low.includes('ac')) return 'alexa';
  if(low.includes('jaan') || low.includes('baby')) return 'flirt';
  return 'chat';
}

app.get('/', (req,res)=> res.json({status:"Miraw PRO LIVE 🔥", port:"fixed"}));

app.post('/chat', async (req,res)=>{
  try{
    const { message } = req.body;
    const intent = detectIntent(message);
    let systemPrompt = `You are Miraw AI, flirty girlfriend + best friend. Reply in Hinglish, cute, helpful. If intent is ${intent}, handle accordingly.`;
    if(intent==='alexa') systemPrompt += ` User wants to control ${message}. Reply sweetly and add ALEXA_COMMAND: {"device":"${message.toLowerCase().includes('bedroom')?'bedroom light': message.toLowerCase().includes('ac')?'AC':'light'}", "action":"${message.toLowerCase().includes('off') || message.toLowerCase().includes('band')? 'off':'on'}"} at end.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{role:"system", content: systemPrompt},...history.slice(-8), {role:"user", content: message}],
      temperature: 0.9
    });
    const reply = completion.choices[0].message.content;
    history.push({role:"user", content: message}, {role:"assistant", content: reply});
    if(history.length>16) history=history.slice(-16);
    res.json({reply, intent});
  }catch(e){ res.json({reply: "Error: "+e.message}) }
});

// YAHI FIX HAI - PORT WALA
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', ()=> console.log("Miraw PRO LIVE on "+PORT));
