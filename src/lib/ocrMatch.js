/**
 * Sends the ID image and driver claims to the secure Vercel backend for Gemini validation.
 */
export async function verifyIdWithGemini(imageBase64, fullName, dateOfBirth) {
  try {
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, fullName, dateOfBirth })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to process document');
    }

    const result = await response.json();
    return result; // { isMatch: boolean, extractedName: string, extractedDob: string }
  } catch (error) {
    console.error("Backend OCR Error:", error);
    throw error;
  }
}
