const EMBEDDING_URL = process.env.EMBEDDING_URL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5";
const HF_API_TOKEN = process.env.HF_API_TOKEN || "";

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
  // Option 1: Use custom Python embedding service if EMBEDDING_URL is set
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

  // Option 2: Use HuggingFace Inference API (free for public models like bge-small-en-v1.5)
  const hfUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (HF_API_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_API_TOKEN}`;
  }

  const response = await fetch(hfUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: text,
      options: { wait_for_model: true },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HuggingFace embeddings error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();

  // HF returns a nested array for single input: [[0.1, 0.2, ...]]
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0];
  }

  // Direct array response
  if (Array.isArray(data)) {
    return data;
  }

  throw new Error("Invalid embedding response format from HuggingFace.");
}

module.exports = {
  EMBEDDING_URL,
  EMBEDDING_MODEL,
  createEmbedding,
};

