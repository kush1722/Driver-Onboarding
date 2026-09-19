const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const fs = require('fs');

async function test() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const dummyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const matches = dummyBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const mimeType = matches[1];
  const data = matches[2];

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: 'Respond with {"matched": true, "reason": ""}' }
                ]
            }
        ],
        config: {
            temperature: 0.0,
            responseMimeType: "application/json"
        }
    });
    console.log("Success:", response.text);
  } catch (err) {
    console.error("Failed:", err);
  }
}
test();
