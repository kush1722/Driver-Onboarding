import { GoogleGenAI } from '@google/genai';

// Array of API keys to load-balance and fallback
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
].filter(Boolean); // Remove any undefined/empty keys

/**
 * Generates content using the Gemini API, with automatic load-balancing and 429 retry logic.
 * @param {Object} options - Options to pass to ai.models.generateContent
 * @returns {Promise<any>} The successful Gemini API response
 */
export async function generateContentWithRotation(options) {
  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys found in environment variables.');
  }

  // To prevent all users from hitting Key 1 simultaneously (which causes lag/blocking),
  // we start at a random key in the array for every new request. 
  // This gives us instant, free load balancing.
  let startIndex = Math.floor(Math.random() * apiKeys.length);
  let attempts = 0;
  let lastError = null;

  while (attempts < apiKeys.length) {
    const currentIndex = (startIndex + attempts) % apiKeys.length;
    const currentKey = apiKeys[currentIndex];
    const ai = new GoogleGenAI({ apiKey: currentKey });

    try {
      console.log(`[Gemini Client] Attempting generation with key index ${currentIndex + 1}/${apiKeys.length}`);
      const response = await ai.models.generateContent(options);
      return response; // Success! Return the response immediately.
    } catch (error) {
      // Check if it's a 429 Quota Exceeded error
      const status = error?.status || error?.response?.status;
      if (status === 429) {
        console.warn(`[Gemini Client] 429 Rate Limit hit on key index ${currentIndex + 1}. Retrying next key...`);
        lastError = error;
        attempts++;
        continue;
      }
      
      // If it's a different error (e.g., 400 Bad Request, invalid base64), don't retry, just throw.
      console.error(`[Gemini Client] Fatal API Error (Status ${status}):`, error.message);
      throw error;
    }
  }

  // If we broke out of the loop, all keys threw a 429.
  console.error('[Gemini Client] All available API keys exhausted their quotas!');
  throw lastError;
}
