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

  const { applicationId, fullName, dateOfBirth, isLicence = false, imageBase64 } = req.body;
  if (!applicationId || !fullName) {
    return res.status(200).json({ isMatch: false, extractedName: 'API ERROR: Missing applicationId. You are on the old frontend. Please clear cache and hard refresh!' });
  }

  try {
    const docType = isLicence ? 'license_front' : 'id_front';
    
    // Get the exact file path from the database (so we don't guess .jpg or .png)
    const { data: docRecord, error: docErr } = await supabase
      .from('documents')
      .select('file_url')
      .eq('application_id', applicationId)
      .eq('type', docType)
      .single();
      
    if (docErr || !docRecord) {
      return res.status(200).json({ isMatch: false, extractedName: `API ERROR: Could not find ${docType} in DB. Missing Service Role Key?` });
    }

    // Create a temporary signed URL to download the image from the private bucket
    const { data: urlData, error: urlErr } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(docRecord.file_url, 60);

    if (urlErr || !urlData?.signedUrl) {
      console.error("Failed to get signed URL:", urlErr);
      return res.status(200).json({ isMatch: false, extractedName: 'API ERROR: Could not get signed URL. Missing Service Role Key?' });
    }

    // Download the image into memory
    const imageRes = await fetch(urlData.signedUrl);
    if (!imageRes.ok) {
      return res.status(200).json({ isMatch: false, extractedName: 'API ERROR: Failed to download document from storage' });
    }
    
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = buffer.toString('base64');
    
    // Dynamically set mimeType so Gemini doesn't crash on PNGs
    const mimeType = docRecord.file_url.endsWith('.png') ? 'image/png' : 'image/jpeg';

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

    const response = await generateContentWithRotation({
        model: 'gemini-1.5-flash',
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
    return res.status(200).json({ isMatch: false, extractedName: `API ERROR: Gemini threw exception: ${error.message}` });
  }
}


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};
