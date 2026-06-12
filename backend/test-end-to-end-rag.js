require("dotenv").config();

const { upsertDocument } = require("./src/ai/retrieval/retrieval.service");
const { answerQuestion } = require("./src/ai/rag/rag.service");

const seedDocuments = [
  {
    id: 10,
    text: "iptables module(s) loaded, but no rules active",
    payload: {
      code: "FIRE-4512",
      message: "iptables module(s) loaded, but no rules active",
      severity: "High",
    },
  },
  {
    id: 11,
    text: "Root login is enabled over SSH",
    payload: {
      code: "AUTH-1021",
      message: "Root login is enabled over SSH",
      severity: "Critical",
    },
  },
  {
    id: 12,
    text: "TLS 1.0 protocol is enabled",
    payload: {
      code: "TLS-3001",
      message: "TLS 1.0 protocol is enabled",
      severity: "Medium",
    },
  },
  {
    id: 13,
    text: "Security updates have not been installed for 90 days",
    payload: {
      code: "PATCH-5002",
      message: "Security updates have not been installed for 90 days",
      severity: "High",
    },
  },
  {
    id: 14,
    text: "Vulnerability in OpenSSL allows remote attackers to execute arbitrary code via a buffer overflow.",
    payload: {
      code: "OPENSSL-4001",
      message: "Vulnerability in OpenSSL allows remote attackers to execute arbitrary code via a buffer overflow.",
      severity: "High",
    },
  },
];

const testCases = [
  {
    question: "What firewall issue exists?",
    expectedCode: "FIRE-4512",
    expectedMessage: "iptables module(s) loaded, but no rules active",
  },
  {
    question: "What SSH security issue exists?",
    expectedCode: "AUTH-1021",
    expectedMessage: "Root login is enabled over SSH",
  },
  {
    question: "What vulnerability affects encryption?",
    expectedCode: "TLS-3001",
    expectedMessage: "TLS 1.0 protocol is enabled",
  },
];

async function seed() {
  console.log("Seeding documents into Qdrant...");
  for (const doc of seedDocuments) {
    await upsertDocument(doc);
    console.log(`  Upserted ${doc.payload.code}`);
  }
}

async function runTests() {
  for (const testCase of testCases) {
    console.log(`\nTesting question: ${testCase.question}`);
    const result = await answerQuestion(testCase.question, { limit: 10 });

    console.log("Context:\n", result.context);
    console.log("Answer:\n", result.answer);

    const hasCode = result.context.includes(testCase.expectedCode);
    const hasMessage = result.context.includes(testCase.expectedMessage);
    const hasAnswer = typeof result.answer === "string" && result.answer.length > 0;

    if (!hasCode || !hasMessage || !hasAnswer) {
      console.error("Test failed:", {
        question: testCase.question,
        expectedCode: testCase.expectedCode,
        expectedMessage: testCase.expectedMessage,
        hasCode,
        hasMessage,
        hasAnswer,
      });
      process.exit(1);
    }

    console.log("✅ Passed");
  }

  console.log("\nAll end-to-end RAG tests passed.");
  process.exit(0);
}

async function main() {
  await seed();
  await runTests();
}

main().catch((err) => {
  console.error("End-to-end RAG test failed:", err);
  process.exit(1);
});
