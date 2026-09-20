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
      You are an expert identity document validator for a Zimbabwean driver onboarding system.
      I am providing an image of an ID document (either a Zimbabwean National ID or a Driver's Licence).
      The user claims their full name is "${fullName}" and their date of birth is "${dateOfBirth || 'Unknown'}".

      STEP 1 — Extract the following from the document:
      - Full name: On Zimbabwean National IDs, the name is split into "Surname" and "Given Name(s)" fields.
        Combine them into a single full name (e.g. Surname "JOHN" + Given Names "JOEL NQOBILE" = "JOHN JOEL NQOBILE").
      - Date of birth (in any format shown on the document)
      - ID/Licence number: For Zimbabwean National IDs, this strictly follows the format digits-dash-digits-letter-digits
        (e.g. "63-2441490 B 63" or "79-176824 K 34"). Stop at the digits — do NOT include anything after, such as
        "CIT M" (Citizen Male), "CIT F" (Citizen Female), city names like "HARARE" or "CHITUNGWIZA", or any other text.
        The ID number ends after the final two-digit suffix.

      STEP 2 — Compare the extracted name and DOB against the user's claims:
      - NAME MATCHING RULES — set isMatch=true if ANY of these apply:
        * SUBSET RULE (most important): Every word in the user's claim appears somewhere in the full name on the ID.
          The ID may have MORE words (e.g. a middle name the user didn't enter). That is fine.
          Example: claim="Joel John" → ID has "JOHN JOEL NQOBILE" → MATCH (both "Joel" and "John" are on the ID)
          Example: claim="Nqobile John" → ID has "JOHN JOEL NQOBILE" → MATCH (both "Nqobile" and "John" are on the ID)
          Example: claim="Joel Nqobile John" → ID has "JOHN JOEL NQOBILE" → MATCH (all three words are on the ID)
        * Minor OCR typos or spelling differences count as the same word
        * All-caps vs mixed-case differences are ignored
      - DOB MATCHING RULES:
        * Be lenient with day/month order (01/09/2005 and 09/01/2005 could both be valid)
        * Partial year matches (e.g. "90" matching "1990")

      Return ONLY a JSON object with the following exact structure, with no markdown formatting:
      {
        "isMatch": true or false,
        "extractedName": "The full name you found on the ID (surname + given names combined)",
        "extractedDob": "The DOB you found on the ID",
        "extractedIdNumber": "The ID/licence number found (or null if not found)"
      }
    `;

    const response = await generateContentWithRotation({
        model: 'gemini-3.8-flash',
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
    // Detect when every model + key combination was exhausted due to 503 overload
    const isServiceUnavailable =
      error?.status === 503 ||
      error?.message?.toLowerCase().includes('unavailable') ||
      error?.message?.includes('503');
    if (isServiceUnavailable) {
      return res.status(200).json({ isMatch: false, serviceUnavailable: true });
    }
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
