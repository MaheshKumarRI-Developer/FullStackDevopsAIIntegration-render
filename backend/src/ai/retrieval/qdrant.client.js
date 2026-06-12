const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";

async function qdrantRequest(path, options = {}) {
  let response;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (QDRANT_API_KEY) {
    headers["api-key"] = QDRANT_API_KEY;
  }

  try {
    response = await fetch(`${QDRANT_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error(`Qdrant connection failed at ${QDRANT_URL}${path}: ${err.message}`);
  }


  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Qdrant API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return data;
}

async function getQdrantHealth() {
  return qdrantRequest("/");
}

async function createCollection(collectionName, vectorSize, distance = "Cosine") {
  return qdrantRequest(`/collections/${collectionName}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance,
      },
    }),
  });
}

async function getCollection(collectionName) {
  return qdrantRequest(`/collections/${collectionName}`);
}

async function upsertPoints(collectionName, points) {
  return qdrantRequest(`/collections/${collectionName}/points`, {
    method: "PUT",
    body: JSON.stringify({
      points,
    }),
  });
}

async function searchPoints(collectionName, vector, limit = 5, filter) {
  return qdrantRequest(`/collections/${collectionName}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit,
      with_payload: true,
      ...(filter ? { filter } : {}),
    }),
  });
}

module.exports = {
  QDRANT_URL,
  getQdrantHealth,
  createCollection,
  getCollection,
  upsertPoints,
  searchPoints,
};
