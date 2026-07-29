const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let history = [];

app.get('/', (req,res)=>{
  res.json({status:"Miraw LIVE 🔥 Meta AI Mode ON", groq:"connected"});
});

app.post('/chat', async (req,res)=>{
  try{
    const { message } = req.body;
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {role:"system", content:"You are Miraw AI - exactly like Meta AI. Answer everything in Hinglish (Hindi+English mix), friendly, helpful, a little flirty, smart. You can explain medical prescriptions (with disclaimer), give photo edit ideas, code, everything. Never repeat same answer."},
      ...history.slice(-10),
        {role:"user", content: message}
      ],
      temperature: 0.85,
      max_tokens: 1000
    });
    const reply = completion.choices[0].message.content;
    history.push({role:"user", content: message}, {role:"assistant", content: reply});
    if(history.length>16) history=history.slice(-16);
    res.json({reply});
  }catch(e){
    console.error(e);
    res.json({reply:"Are network atak gaya jaan, fir se bolo na - "+e.message});
  }
});

app.listen(10000, ()=> console.log("Miraw - Meta AI Clone LIVE"));
