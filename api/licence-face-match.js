import { generateContentWithRotation } from './_gemini-client.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ matched: false, reason: 'Method not allowed' });
  }

  const { applicationId, imageBase64 } = req.body;
  if (!applicationId) {
    return res.status(200).json({ matched: false, reason: 'API ERROR: Missing applicationId. Please do a hard refresh!' });
  }

  try {
    // Helper function to fetch image from Supabase Storage and convert to Base64
    const fetchImageAsBase64 = async (docType) => {
      // 1. Get exact file path from DB
      const { data: docRecord, error: docErr } = await supabase
        .from('documents')
        .select('file_url')
        .eq('application_id', applicationId)
        .eq('type', docType)
        .single();
        
      if (docErr || !docRecord) throw new Error(`Could not find ${docType} in database`);

      // 2. Fetch signed URL
      const { data: urlData, error: urlErr } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(docRecord.file_url, 60);

      if (urlErr || !urlData?.signedUrl) throw new Error(`Could not access ${docType} in storage`);

      // 3. Download image
      const imageRes = await fetch(urlData.signedUrl);
      if (!imageRes.ok) throw new Error(`Failed to download ${docType}`);

      const arrayBuffer = await imageRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = docRecord.file_url.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      return { 
        data: buffer.toString('base64'), 
        mimeType 
      };
    };

    // Download both images into memory using their correct file paths
    const licenceObj = await fetchImageAsBase64('license_front');
    const selfieObj = await fetchImageAsBase64('selfie');
    
    const licenceData = licenceObj.data;
    const licenceMime = licenceObj.mimeType;
    const selfieData = selfieObj.data;
    const selfieMime = selfieObj.mimeType;

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
    console.error("Face Match API Error:", error);
    return res.status(200).json({ matched: false, reason: `API ERROR: Gemini threw exception: ${error.message}` });
  }
}


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};
