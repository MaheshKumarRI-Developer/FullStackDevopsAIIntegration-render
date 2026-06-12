/**
 * JSON Parser for AI Responses
 * Handles broken or malformed JSON from LLMs
 */

/**
 * Attempts to parse JSON with fallback error handling
 * @param {string} jsonString - The string to parse
 * @returns {object} - Parsed JSON object or empty object if parsing fails
 */
function parseJSON(jsonString) {
  if (!jsonString || typeof jsonString !== "string") {
    return {};
  }

  // Try strict parsing first
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Fallback to cleaning and retry
  }

  // Try to extract JSON from text (LLMs sometimes add extra text)
  const jsonMatch = jsonString.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      // Continue to cleanup
    }
  }

  // Try aggressive cleanup
  try {
    const cleaned = cleanJSON(jsonString);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse JSON:", error.message);
    return {};
  }
}

/**
 * Clean common JSON formatting issues from LLM responses
 * @param {string} jsonString - Potentially malformed JSON
 * @returns {string} - Cleaned JSON string
 */
function cleanJSON(jsonString) {
  let cleaned = jsonString;

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  // Fix single quotes to double quotes (but be careful with contractions)
  // This is a simple replacement - may need refinement
  cleaned = cleaned.replace(/': /g, '": ');
  cleaned = cleaned.replace(/: '/g, ': "');
  cleaned = cleaned.replace(/'([^']*)'/g, '"$1"');

  // Remove comments (both // and /* */)
  cleaned = cleaned.replace(/\/\/.*$/gm, ""); // Single-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ""); // Multi-line comments

  // Fix unquoted keys (common in LLM output)
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // Remove extra whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Parse and validate AI response with schema
 * @param {string} jsonString - JSON string to parse
 * @param {object} schema - Expected schema with required fields
 * @returns {object} - Validated parsed object
 */
function parseAndValidate(jsonString, schema = {}) {
  const parsed = parseJSON(jsonString);

  if (Object.keys(schema).length === 0) {
    return parsed;
  }

  // Validate required fields
  const validated = {};
  for (const [key, type] of Object.entries(schema)) {
    if (parsed.hasOwnProperty(key)) {
      const value = parsed[key];
      if (type === "string" && typeof value === "string") {
        validated[key] = value;
      } else if (type === "number" && typeof value === "number") {
        validated[key] = value;
      } else if (type === "boolean" && typeof value === "boolean") {
        validated[key] = value;
      } else if (type === "array" && Array.isArray(value)) {
        validated[key] = value;
      } else if (type === "object" && typeof value === "object" && !Array.isArray(value)) {
        validated[key] = value;
      } else {
        validated[key] = null;
      }
    } else {
      validated[key] = null;
    }
  }

  return validated;
}

/**
 * Extract specific fields from AI response
 * @param {string} jsonString - JSON string
 * @param {array} fields - Fields to extract
 * @returns {object} - Object with extracted fields
 */
function extractFields(jsonString, fields = []) {
  const parsed = parseJSON(jsonString);
  const extracted = {};

  for (const field of fields) {
    extracted[field] = parsed[field] || null;
  }

  return extracted;
}

/**
 * Parse AI response and flatten nested structure
 * @param {string} jsonString - JSON string
 * @returns {object} - Flattened object
 */
function parseFlatten(jsonString) {
  const parsed = parseJSON(jsonString);
  return flattenObject(parsed);
}

/**
 * Helper: Flatten nested object
 * @param {object} obj - Object to flatten
 * @param {string} prefix - Prefix for keys
 * @returns {object} - Flattened object
 */
function flattenObject(obj, prefix = "") {
  const flattened = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

module.exports = {
  parseJSON,
  cleanJSON,
  parseAndValidate,
  extractFields,
  parseFlatten,
};
