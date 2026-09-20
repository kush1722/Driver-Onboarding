require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

// Dynamically import the ES module
async function run() {
  const { generateContentWithRotation } = await import('./api/_gemini-client.js');

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const applicationId = '55505e88-5ca2-48fa-a8ea-111847964f13';
  
  const { data: docRecord } = await supabase.from('documents').select('file_url').eq('application_id', applicationId).eq('type', 'license_front').single();
  const { data: urlData } = await supabase.storage.from('driver-documents').createSignedUrl(docRecord.file_url, 60);
  
  const imageRes = await fetch(urlData.signedUrl);
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const data = buffer.toString('base64');
  
  try {
    console.log("Sending to Gemini as image/jpeg...");
    const response = await generateContentWithRotation({
        model: 'gemini-3.6-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data } },
                    { text: "What is this?" }
                ]
            }
        ]
    });
    console.log("Response:", response.text);
  } catch (err) {
    console.error("Gemini Error:", err);
  }
}
run();
