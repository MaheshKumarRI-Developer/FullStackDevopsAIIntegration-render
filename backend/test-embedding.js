const { createEmbedding } = require("./src/ai/retrieval/embedding.client.js");

async function main() {
  const embedding = await createEmbedding("What firewall issue exists?");

  console.log("Dimensions:", embedding.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
