const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function urlToBase64(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return 'data:image/jpeg;base64,' + buffer.toString('base64');
}

async function test() {
  const appId = '55505e88-5ca2-48fa-a8ea-111847964f13';
  
  // Get selfie
  const { data: selfieUrl } = await supabase.storage.from('driver-documents').createSignedUrl(`${appId}/selfie.jpg`, 3600);
  // Get license_front
  const { data: licenseUrl } = await supabase.storage.from('driver-documents').createSignedUrl(`${appId}/license_front.jpg`, 3600);

  if (!selfieUrl || !licenseUrl) {
    console.error("Missing images in bucket");
    return;
  }

  const selfieBase64 = await urlToBase64(selfieUrl.signedUrl);
  const licenseBase64 = await urlToBase64(licenseUrl.signedUrl);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_1 });

  const selfieMatches = selfieBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const licenseMatches = licenseBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  const prompt = `
      Your task: determine whether the face on the driver's licence belongs to the same person as in the selfie.
      Allow for natural differences in lighting, angle, ageing, and photo quality between an ID photo and a selfie.
      CRITICAL: If the user uploads the exact same image twice (e.g., an ID card for both), or if the "selfie" image appears to be a photo of an ID card, YOU MUST STILL COMPARE THE FACES. Do NOT reject the match just because the selfie is not a "live" photo. Focus SOLELY on whether the faces belong to the same person.

      If they do NOT match, or you cannot confidently confirm a match, set "matched" to false
      and explain WHY in the "reason" field. Keep the reason short and actionable for the user
      (e.g. "Licence photo is too blurry to compare", "Please ensure you are looking directly at the camera", "Faces do not appear to match").

      Return ONLY a JSON object with this exact structure — no markdown, no extra text:
      {
        "matched": true or false,
        "reason": "Short explanation (empty string if matched is true)"
      }
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      config: { temperature: 0.0, responseMimeType: "application/json" },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: licenseMatches[1], data: licenseMatches[2] } },
            { inlineData: { mimeType: selfieMatches[1], data: selfieMatches[2] } },
            { text: prompt }
          ]
        }
      ]
    });
    console.log("RESULT:", response.text);
  } catch (err) {
    console.error(err);
  }
}

test();
