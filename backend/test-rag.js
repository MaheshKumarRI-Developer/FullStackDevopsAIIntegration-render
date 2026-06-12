require("dotenv").config();
const { upsertDocument } = require("./src/ai/retrieval/retrieval.service");
const { answerQuestion } = require("./src/ai/rag/rag.service");

async function main() {
  console.log("Starting RAG service test...");

  const sampleDoc = {
    id: 2,
    text: "Root login is enabled over SSH",
    payload: {
      code: "AUTH-1021",
      message: "Root login is enabled over SSH",
      severity: "Critical",
    },
  };

  console.log("Upserting sample document...");
  await upsertDocument(sampleDoc);

  const question = "What SSH security issue exists?";
  console.log(`Answering question: ${question}`);

  const result = await answerQuestion(question, { limit: 5 });
  console.log("Result:", JSON.stringify(result, null, 2));

  if (
    result.context.includes("AUTH-1021") &&
    result.context.includes("Root login is enabled over SSH") &&
    result.answer
  ) {
    console.log("✅ RAG service produced expected context and an answer.");
    process.exit(0);
  }

  console.error("❌ Expected content not found in result or answer missing.");
  process.exit(1);
}

main().catch((error) => {
  console.error("RAG test failed:", error);
  process.exit(1);
});
