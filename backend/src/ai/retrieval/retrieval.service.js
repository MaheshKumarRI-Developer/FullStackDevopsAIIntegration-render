const { createEmbedding } = require("./embedding.client");
const { searchPoints, upsertPoints } = require("./qdrant.client");
const { buildContextFromDocuments } = require("../context/context.builder");

const DEFAULT_COLLECTION = process.env.QDRANT_COLLECTION || "cve_knowledge_base_v2";

async function upsertDocument({ id, text, payload = {}, collectionName = DEFAULT_COLLECTION }) {
  const embedding = await createEmbedding(text);

  const point = {
    id,
    vector: embedding,
    payload: {
      ...payload,
      text,
    },
  };

  return upsertPoints(collectionName, [point]);
}

async function searchSimilar({ query, limit = 5, filter, collectionName = DEFAULT_COLLECTION }) {
  const embedding = await createEmbedding(query);

  return searchPoints(
    collectionName,
    embedding,
    limit,
    filter
  );
}

module.exports = {
  DEFAULT_COLLECTION,
  upsertDocument,
  searchSimilar,
  buildContextFromDocuments,
};
