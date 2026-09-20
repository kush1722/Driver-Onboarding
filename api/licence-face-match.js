import { generateContentWithRotation } from './_gemini-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { licenceFrontBase64, selfieBase64 } = req.body;
  if (!licenceFrontBase64 || !selfieBase64) {
    return res.status(400).json({ error: 'Missing required images: licenceFrontBase64 and selfieBase64' });
  }

  try {

    // Parse licence image
    const licenceMatches = licenceFrontBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!licenceMatches) return res.status(400).json({ error: 'Invalid licence base64 string' });
    let licenceMime = licenceMatches[1];
    const licenceData = licenceMatches[2];

    // Parse selfie image
    const selfieMatches = selfieBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!selfieMatches) return res.status(400).json({ error: 'Invalid selfie base64 string' });
    let selfieMime = selfieMatches[1];
    const selfieData = selfieMatches[2];

    if (licenceMime === 'application/octet-stream') licenceMime = 'image/jpeg';
    if (selfieMime === 'application/octet-stream') selfieMime = 'image/jpeg';

    const prompt = `
      You are an expert biometric verification system.
      I am providing two images:
      1. A driver's licence document (the photo printed on the licence)
      2. A live selfie photo of the applicant taken during onboarding

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

    const response = await generateContentWithRotation({
      model: 'gemini-3.6-flash',
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: licenceMime, data: licenceData } },
            { inlineData: { mimeType: selfieMime, data: selfieData } },
            { text: prompt }
          ]
        }
      ]
    });

    const textResponse = response.text;
    console.log('=== GEMINI LICENCE FACE MATCH RAW ===', textResponse);
    const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    console.log('=== GEMINI LICENCE FACE MATCH PARSED ===', result);

    return res.status(200).json({
      matched: result.matched,
      reason: result.reason || ''
    });
  } catch (error) {
    console.error('Gemini Licence Face Match Error:', error);
    return res.status(500).json({ error: 'Failed to compare licence to selfie' });
  }
}
