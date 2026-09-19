import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { idImageBase64, selfieImageBase64 } = req.body;
  if (!idImageBase64 || !selfieImageBase64) {
    return res.status(400).json({ error: 'Missing required images' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Parse ID image
    const idMatches = idImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!idMatches) return res.status(400).json({ error: 'Invalid ID base64 string' });
    const idMime = idMatches[1];
    const idData = idMatches[2];

    // Parse Selfie image
    const selfieMatches = selfieImageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!selfieMatches) return res.status(400).json({ error: 'Invalid Selfie base64 string' });
    const selfieMime = selfieMatches[1];
    const selfieData = selfieMatches[2];

    const prompt = `
      You are an expert biometric verification system. 
      I am providing two images:
      1. An ID document photo
      2. A live selfie photo
      
      Compare the face in the ID document to the face in the selfie. 
      Are they the exact same person? Allow for natural aging, different lighting, and different angles.
      
      If they do NOT match or you cannot tell, explain WHY in the "reason" field. 
      Is the lighting bad? Is the face blurry? Is the person not looking at the camera? Is it clearly a different person?
      Keep the reason short and helpful for the user (e.g., "Please move to better lighting", "Ensure your face is clearly visible", "Faces do not match").
      
      Return ONLY a JSON object with this structure (no markdown):
      {
        "matched": true or false,
        "reason": "String explaining why (only if matched is false, otherwise empty string)"
      }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        config: {
          temperature: 0.0,
          responseMimeType: "application/json",
        },
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: idMime, data: idData } },
                    { inlineData: { mimeType: selfieMime, data: selfieData } },
                    { text: prompt }
                ]
            }
        ]
    });

    const textResponse = response.text;
    console.log("=== GEMINI FACE MATCH RAW RESPONSE ===", textResponse);
    const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    console.log("=== GEMINI FACE MATCH PARSED ===", result);

    return res.status(200).json({ 
      matched: result.matched, 
      reason: result.reason || '',
      distance: result.matched ? 0.1 : 0.9 // Mock distance for frontend compatibility
    });
  } catch (error) {
    console.error("Gemini Face Match Error:", error);
    return res.status(500).json({ error: 'Failed to verify faces' });
  }
}
