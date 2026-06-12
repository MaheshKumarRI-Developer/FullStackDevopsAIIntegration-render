const GROQ_API_KEY = process.env.GROQ_API_KEY;
const EMBEDDING_URL = process.env.EMBEDDING_URL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

function normalizeEmbeddingUrl(url) {
  if (!url) {
    return null;
  }

  if (url.endsWith("/embed")) {
    return url;
  }

  return `${url.replace(/\/+$/, "")}/embed`;
}

async function createEmbedding(text) {
  if (EMBEDDING_URL) {
    const url = normalizeEmbeddingUrl(EMBEDDING_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embedding from custom service: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY environment variable for embedding generation.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GROQ embeddings error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || !data.data[0]?.embedding) {
    throw new Error("Invalid embedding response format from Groq.");
  }

  return data.data[0].embedding;
}

module.exports = {
  EMBEDDING_URL,
  EMBEDDING_MODEL,
  createEmbedding,
};
