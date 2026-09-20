import { GoogleGenAI } from '@google/genai';

// Array of API keys to load-balance and fallback
const apiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
].filter(Boolean);

// Stable fallback model used when the primary model is fully overloaded.
const FALLBACK_MODEL = 'gemini-2.0-flash';

/**
 * Extracts the HTTP status code from a Gemini SDK error.
 *
 * The @google/genai SDK embeds error info in different ways depending on the
 * version and error type. We check all known locations:
 *   1. error.status         — numeric HTTP code (some SDK versions)
 *   2. error.response.status — raw fetch response
 *   3. error.message        — often contains the raw JSON body, e.g.:
 *        {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
 *      or just the string "503" somewhere inside it.
 */
function extractStatus(error) {
  // 1. Direct numeric status property
  if (typeof error?.status === 'number') return error.status;

  // 2. Nested response object
  if (typeof error?.response?.status === 'number') return error.response.status;

  // 3. Parse from the message string (most common with @google/genai)
  const msg = error?.message || '';
  // Try to parse embedded JSON body: {"error":{"code":503,...}}
  try {
    const parsed = JSON.parse(msg);
    const code = parsed?.error?.code;
    if (typeof code === 'number') return code;
  } catch (_) { /* not JSON */ }

  // Try plain numeric match: "... 503 ..."
  const match = msg.match(/\b(4\d{2}|5\d{2})\b/);
  if (match) return parseInt(match[1], 10);

  // Check for known status strings
  if (msg.includes('UNAVAILABLE') || msg.toLowerCase().includes('high demand')) return 503;
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) return 429;

  return null;
}

/**
 * Fires all API keys simultaneously for a given model and returns the
 * first successful response. If all keys fail, returns the failure reasons.
 */
async function raceAllKeys(options, model) {
  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys found in environment variables.');
  }

  console.log(`[Gemini Client] Racing ${apiKeys.length} keys simultaneously for model "${model}"...`);

  const keyPromises = apiKeys.map((key, i) => {
    const ai = new GoogleGenAI({ apiKey: key });
    return ai.models.generateContent({ ...options, model })
      .then(response => {
        console.log(`[Gemini Client] ✅ Key ${i + 1} succeeded for model "${model}".`);
        return response;
      })
      .catch(error => {
        const status = extractStatus(error);
        console.warn(`[Gemini Client] ❌ Key ${i + 1} failed for model "${model}" — status: ${status}, message: ${error?.message?.slice(0, 120)}`);
        throw error;
      });
  });

  try {
    const response = await Promise.any(keyPromises);
    return { response };
  } catch (aggregateError) {
    const errors = aggregateError.errors || [];
    return { allErrors: errors };
  }
}

/**
 * Generates content using the Gemini API with:
 * - All keys fired in parallel → first success wins
 * - Robust status extraction from SDK error messages
 * - Automatic model fallback to gemini-2.0-flash if every key returns 503
 */
export async function generateContentWithRotation(options) {
  const primaryModel = options.model;

  // 1. Race all keys for the primary model simultaneously
  const primaryResult = await raceAllKeys(options, primaryModel);

  if (primaryResult.response) {
    return primaryResult.response; // ✅ Done
  }

  // 2. All keys failed — extract statuses robustly
  const errors = primaryResult.allErrors || [];
  const statuses = errors.map(extractStatus);

  console.log(`[Gemini Client] All keys failed for "${primaryModel}". Extracted statuses:`, statuses);

  const all503 = statuses.length > 0 && statuses.every(s => s === 503);
  const all429 = statuses.length > 0 && statuses.every(s => s === 429);

  // Check for a fatal non-retriable error (e.g. 400 Bad Request)
  const fatalError = errors.find(e => {
    const s = extractStatus(e);
    return s && s !== 429 && s !== 503;
  });
  if (fatalError) throw fatalError;

  // 3. All 503s → model-level overload → try fallback model
  if (all503 && primaryModel !== FALLBACK_MODEL) {
    console.warn(`[Gemini Client] 🔄 All keys returned 503 for "${primaryModel}". Falling back to "${FALLBACK_MODEL}"...`);
    const fallbackResult = await raceAllKeys(options, FALLBACK_MODEL);

    if (fallbackResult.response) {
      console.log(`[Gemini Client] ✅ Fallback model "${FALLBACK_MODEL}" succeeded.`);
      return fallbackResult.response;
    }

    console.error(`[Gemini Client] ❌ Fallback model "${FALLBACK_MODEL}" also failed.`);
    throw new Error(`Both "${primaryModel}" and "${FALLBACK_MODEL}" are currently unavailable. Please try again in a moment.`);
  }

  // 4. All 429s → quota exhausted
  if (all429) {
    console.error('[Gemini Client] All API keys have exhausted their quotas (429).');
  } else {
    // Mixed or unknown errors
    console.error('[Gemini Client] All API keys failed with mixed/unknown statuses:', statuses);
    // If we couldn't determine statuses (SDK format unknown), treat as 503 and try fallback
    if (statuses.every(s => s === null) && primaryModel !== FALLBACK_MODEL) {
      console.warn(`[Gemini Client] Unknown statuses — attempting fallback to "${FALLBACK_MODEL}" as a safety net...`);
      const fallbackResult = await raceAllKeys(options, FALLBACK_MODEL);
      if (fallbackResult.response) {
        console.log(`[Gemini Client] ✅ Safety-net fallback model "${FALLBACK_MODEL}" succeeded.`);
        return fallbackResult.response;
      }
    }
  }

  throw errors[0] || new Error('All Gemini API keys failed.');
}
