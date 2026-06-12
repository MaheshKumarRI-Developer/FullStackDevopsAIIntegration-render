const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

async function createChatCompletion(messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }

  const {
    model = GROQ_MODEL,
    temperature = 0.7,
    responseFormat,
  } = options;

  const body = {
    model,
    messages,
    temperature,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GROQ API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  return data;
}

module.exports = {
  createChatCompletion,
  GROQ_MODEL,
  isConfigured: Boolean(GROQ_API_KEY),
};
