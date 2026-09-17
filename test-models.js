import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config();

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'hello'
    });
    console.log("Success with gemini-2.0-flash!");
  } catch (e) {
    console.error("2.0 flash failed", e.message);
  }
}
run();
