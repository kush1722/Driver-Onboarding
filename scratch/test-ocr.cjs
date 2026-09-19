const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const fs = require('fs');

async function test() {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Dummy 1x1 image
  const dummyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const matches = dummyBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const mimeType = matches[1];
  const data = matches[2];

  const prompt = `
      You are an expert identity document validator.
      I am providing an image of an ID document.
      The user claims their full name is "Kudzai Nyakwima" and their date of birth is "2000-03-17".
      Carefully extract the name, date of birth, and the unique ID number...
      Return ONLY a JSON object with this exact structure:
      {
        "isMatch": true or false,
        "extractedName": "...",
        "extractedDob": "...",
        "extractedIdNumber": "..."
      }
    `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            }
        ],
        config: {
            temperature: 0.0,
            responseMimeType: "application/json"
        }
    });
    console.log("OCR Success:", response.text);
  } catch (err) {
    console.error("OCR Failed:", err);
  }
}
test();
