require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const applicationId = '55505e88-5ca2-48fa-a8ea-111847964f13';
  const path = `${applicationId}/license_front.jpg`; // User used licence
  
  const { data: urlData, error: urlErr } = await supabase.storage
    .from('driver-documents')
    .createSignedUrl(path, 60);

  if (urlErr) {
    console.error("Signed URL Error:", urlErr);
    return;
  }
  
  console.log("Signed URL:", urlData.signedUrl);

  const imageRes = await fetch(urlData.signedUrl);
  console.log("Fetch Status:", imageRes.status);
  
  if (!imageRes.ok) {
    console.error("Failed to download image");
    return;
  }
  
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const data = buffer.toString('base64');
  
  console.log("Base64 Length:", data.length);
}
test();
