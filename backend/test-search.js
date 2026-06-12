const { upsertDocument, searchSimilar, DEFAULT_COLLECTION } = require("./src/ai/retrieval/retrieval.service");

async function main() {
  console.log("Starting Qdrant retrieval test...");
  console.log(`Using collection: ${DEFAULT_COLLECTION}`);

  const document = {
    id: 1,
    text: "Vulnerability in OpenSSL allows remote attackers to execute arbitrary code via a buffer overflow.",
    payload: {
      source: "test",
      severity: "HIGH",
    },
  };

  console.log("Upserting test document...");
  const upsertResponse = await upsertDocument(document);
  console.log("Upsert response:", upsertResponse);

  const query = "remote code execution buffer overflow in OpenSSL";
  console.log(`Searching for similar documents for query: ${query}`);
  const results = await searchSimilar({ query, limit: 3 });

  console.log("Search results:");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
