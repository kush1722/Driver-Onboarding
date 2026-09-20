import { generateContentWithRotation } from './_gemini-client.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { applicationId } = req.body;
  if (!applicationId) {
    return res.status(400).json({ error: 'Missing required field: applicationId' });
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
    const idObj = await fetchImageAsBase64('id_front');
    const selfieObj = await fetchImageAsBase64('selfie');
    
    const idData = idObj.data;
    const idMime = idObj.mimeType;
    const selfieData = selfieObj.data;
    const selfieMime = selfieObj.mimeType;

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


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};
