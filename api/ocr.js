import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, fullName, dateOfBirth } = req.body;
  if (!imageBase64 || !fullName) {
    return res.status(400).json({ error: 'Missing required fields: imageBase64 and fullName' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // imageBase64 comes as "data:image/jpeg;base64,/9j/4AAQ..."
    // We need to strip the prefix for the Gemini API
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }
    
    const mimeType = matches[1];
    const data = matches[2];

    const prompt = `
      You are an expert identity document validator.
      I am providing an image of an ID document.
      The user claims their full name is "${fullName}" and their date of birth is "${dateOfBirth || 'Unknown'}".
      Carefully extract the name, date of birth, and the unique ID number (e.g. document number, license number, or national ID number) from the document.
      IMPORTANT: If this is a Zimbabwean National ID, the ID number strictly follows the format of digits, a dash, more digits, a single letter, and two final digits (e.g., "79-176824K34" or "08-123456 A 12"). Do NOT include the city name (e.g., "HARARE") or any other extraneous text in the extractedIdNumber field.
      Do the name and DOB match the user's claims? 
      Be reasonably lenient with OCR typos, name order, or date formats (e.g. 01/12/90 matches Dec 1st 1990).
      Return ONLY a JSON object with the following exact structure, with no markdown formatting:
      {
        "isMatch": true or false,
        "extractedName": "The name you found on the ID",
        "extractedDob": "The DOB you found on the ID",
        "extractedIdNumber": "The ID number you found on the document (or null if not found)"
      }
    `;

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

    const textResponse = response.text;
    
    // Clean potential markdown blocks
    const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: 'Failed to process ID document' });
  }
}
