require('dotenv').config({ path: '.env' });
async function run() { 
  const { generateContentWithRotation } = await import('../api/_gemini-client.js'); 
  const { createClient } = require('@supabase/supabase-js'); 
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); 
  const appId = '55505e88-5ca2-48fa-a8ea-111847964f13'; 
  const { data: docRecord } = await supabase.from('documents').select('file_url').eq('application_id', appId).eq('type', 'license_front').single(); 
  const { data: urlData } = await supabase.storage.from('driver-documents').createSignedUrl(docRecord.file_url, 60); 
  const imageRes = await fetch(urlData.signedUrl); 
  const buffer = Buffer.from(await imageRes.arrayBuffer()); 
  const data = buffer.toString('base64'); 
  console.log('Testing OCR with ' + docRecord.file_url); 
  const prompt = `
      You are an expert identity document validator.
      I am providing an image of an ID document.
      The user claims their full name is "Kudzai Nyakwima" and their date of birth is "2000-03-17".
      Carefully extract the name, date of birth, and the unique ID number.
      Do the name and DOB match the user's claims? 
      Be reasonably lenient with OCR typos, name order, or date formats.
      Return ONLY a JSON object with the following exact structure, with no markdown formatting:
      {
        "isMatch": true or false,
        "extractedName": "The name you found on the ID",
        "extractedDob": "The DOB you found on the ID",
        "extractedIdNumber": "The ID number you found on the document (or null if not found)"
      }
  `; 
  try { 
    const response = await generateContentWithRotation({ 
      model: 'gemini-3.6-flash', 
      contents: [ 
        { role: 'user', parts: [ 
          { inlineData: { mimeType: docRecord.file_url.endsWith('.png') ? 'image/png' : 'image/jpeg', data } }, 
          { text: prompt } 
        ] } 
      ], 
      config: { temperature: 0.0, responseMimeType: 'application/json' } 
    }); 
    console.log('OCR Response:', response.text); 
  } catch (err) { 
    console.error('Gemini Error:', err); 
  } 
} 
run();
