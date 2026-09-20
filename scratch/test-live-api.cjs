const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function urlToBase64(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return 'data:image/jpeg;base64,' + buffer.toString('base64');
}

async function test() {
  const appId = '55505e88-5ca2-48fa-a8ea-111847964f13';
  
  const { data: selfieUrl } = await supabase.storage.from('driver-documents').createSignedUrl(`${appId}/selfie.jpg`, 3600);
  const { data: licenseUrl } = await supabase.storage.from('driver-documents').createSignedUrl(`${appId}/license_front.jpg`, 3600);

  const selfieBase64 = await urlToBase64(selfieUrl.signedUrl);
  const licenseBase64 = await urlToBase64(licenseUrl.signedUrl);

  console.log("Sending payload to LIVE API...");
  console.log("Selfie length:", selfieBase64.length);
  console.log("License length:", licenseBase64.length);

  // Actually hit the live API
  try {
    const res = await fetch('https://driver-onboarding-git-main-kush1722s-projects.vercel.app/api/licence-face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenceFrontBase64: licenseBase64,
        selfieBase64: selfieBase64,
      }),
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
