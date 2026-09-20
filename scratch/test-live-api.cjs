async function test() {
  const appId = '55505e88-5ca2-48fa-a8ea-111847964f13';
  const HOST = 'https://driver-app-frontend-3s35w95vw-kush1722s-projects.vercel.app'; // From screenshot
  
  console.log(`Testing OCR on ${HOST}...`);
  try {
    const ocrRes = await fetch(`${HOST}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: appId,
        fullName: 'Kudzai Nyakwima',
        dateOfBirth: '2000-03-17',
        isLicence: true
      }),
    });
    console.log("OCR Status:", ocrRes.status);
    console.log("OCR Response:", await ocrRes.text());
  } catch (err) {
    console.error(err);
  }

  console.log("\nTesting Face Match...");
  try {
    const faceRes = await fetch(`${HOST}/api/licence-face-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: appId
      }),
    });
    console.log("Face Match Status:", faceRes.status);
    console.log("Face Match Response:", await faceRes.text());
  } catch (err) {
    console.error(err);
  }
}
test();
