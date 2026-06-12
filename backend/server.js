require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const groqProvider = require("./src/ai/providers/groqProvider");
const ragService = require("./src/ai/rag/rag.service");
const { getQdrantHealth } = require("./src/ai/retrieval/qdrant.client");
const { buildVulnerabilityPrompt, buildRemediationPrompt, buildRiskAssessmentPrompt } = require("./src/ai/prompts/vulnerabilityPrompt");
const { parseJSON, parseAndValidate, extractFields } = require("./src/ai/parsers/jsonParser");
const { runCveOrchestrator } = require("./src/ai/orchestrator/cveOrchestrator");
const {
  validateAgainstSchema,
  vulnerabilityAnalysisSchema,
  remediationSchema,
  riskAssessmentSchema,
} = require("./src/ai/schemas");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Backend running"
  });
});

app.get("/api/ai/health", (req, res) => {
  res.json({
    provider: "groq",
    configured: groqProvider.isConfigured,
    model: groqProvider.GROQ_MODEL,
  });
});

app.get("/api/ai/qdrant-health", async (req, res) => {
  try {
    const health = await getQdrantHealth();
    res.json({ status: "ok", qdrant: health });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: "unavailable", error: error.message });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "The request body must include a non-empty messages array." });
  }

  try {
    const result = await groqProvider.createChatCompletion(messages);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "The request body must include a question string." });
  }

  try {
    const result = await ragService.answerQuestion(question, { limit: 5 });
    res.json({ answer: result.answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to retrieve real data from Qdrant. Ensure the Qdrant service is running and the vector database is available.',
      details: error.message,
    });
  }
});

// Dedicated mock endpoint to test chat UI without Qdrant
app.post('/api/chat/mock', (req, res) => {
  const { question } = req.body || {};
  const q = (question || '').toLowerCase();
  let canned = 'No relevant vulnerability found.';
  if (q.includes('firewall')) {
    canned = 'The firewall issue is that the iptables module(s) are loaded, but no rules are active (FIRE-4512).';
  } else if (q.includes('ssh')) {
    canned = 'Root login is enabled over SSH (AUTH-1021).';
  } else if (q.includes('encrypt') || q.includes('openssl') || q.includes('encryption')) {
    canned = 'OpenSSL buffer-overflow vulnerability allows remote code execution (OPENSSL-4001).';
  }

  res.json({ answer: canned, mock: true });
});

// Endpoint to ingest raw text/knowledge directly into the Qdrant vector database
app.post("/api/knowledge", async (req, res) => {
  const { id, text, payload, collectionName } = req.body;

  if (id === undefined || !text) {
    return res.status(400).json({ error: "id and text are required in the request body." });
  }

  try {
    const { upsertDocument } = require("./src/ai/retrieval/retrieval.service");
    const result = await upsertDocument({
      id: Number(id),
      text,
      payload: payload || {},
      collectionName,
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to import knowledge to Qdrant database.",
      details: error.message,
    });
  }
});


async function runStructuredAi(messages, schema) {
  const result = await groqProvider.createChatCompletion(messages, {
    temperature: 0.2,
    responseFormat: { type: "json_object" },
  });
  const content = result.choices?.[0]?.message?.content || "";
  const parsed = parseJSON(content);
  const validation = validateAgainstSchema(parsed, schema);

  return {
    raw: result,
    parsed,
    validation,
  };
}

app.post("/api/ai/analyze-cve", async (req, res) => {
  const { cveData } = req.body;

  if (!cveData) {
    return res.status(400).json({ error: "CVE data is required" });
  }

  try {
    const messages = buildVulnerabilityPrompt(cveData);
    const result = await runStructuredAi(messages, vulnerabilityAnalysisSchema);

    if (!result.validation.valid) {
      return res.status(502).json({
        error: "AI response did not match vulnerability analysis schema.",
        validation: result.validation,
        parsed: result.parsed,
      });
    }

    res.json({ success: true, data: result.validation.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/remediate-cve", async (req, res) => {
  const { cveData } = req.body;

  if (!cveData) {
    return res.status(400).json({ error: "CVE data is required" });
  }

  try {
    const messages = buildRemediationPrompt(cveData);
    const result = await runStructuredAi(messages, remediationSchema);

    if (!result.validation.valid) {
      return res.status(502).json({
        error: "AI response did not match remediation schema.",
        validation: result.validation,
        parsed: result.parsed,
      });
    }

    res.json({ success: true, data: result.validation.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/assess-risk", async (req, res) => {
  const { cveData } = req.body;

  if (!cveData) {
    return res.status(400).json({ error: "CVE data is required" });
  }

  try {
    const messages = buildRiskAssessmentPrompt(cveData);
    const result = await runStructuredAi(messages, riskAssessmentSchema);

    if (!result.validation.valid) {
      return res.status(502).json({
        error: "AI response did not match risk assessment schema.",
        validation: result.validation,
        parsed: result.parsed,
      });
    }

    res.json({ success: true, data: result.validation.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/orchestrate-cve", async (req, res) => {
  const { cveData } = req.body;

  if (!cveData) {
    return res.status(400).json({ error: "CVE data is required" });
  }

  try {
    const workflow = await runCveOrchestrator(cveData);
    const statusCode = workflow.status === "completed" ? 200 : 207;
    res.status(statusCode).json({ success: workflow.status === "completed", data: workflow });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/parse-json", (req, res) => {
  const { jsonString, schemaName, schema, fieldsToExtract } = req.body;

  if (!jsonString) {
    return res.status(400).json({ error: "jsonString is required" });
  }

  try {
    let result;

    // If a named schema is provided, use the project's schema validation
    if (schemaName && typeof schemaName === "string") {
      const parsed = parseJSON(jsonString);

      const schemaMap = {
        vulnerability: vulnerabilityAnalysisSchema,
        remediation: remediationSchema,
        risk: riskAssessmentSchema,
      };

      const selectedSchema = schemaMap[schemaName];
      if (!selectedSchema) {
        return res.status(400).json({ error: `Unknown schemaName '${schemaName}'` });
      }

      result = validateAgainstSchema(parsed, selectedSchema);
    } else if (fieldsToExtract && Array.isArray(fieldsToExtract)) {
      result = extractFields(jsonString, fieldsToExtract);
    } else if (schema && typeof schema === "object") {
      result = parseAndValidate(jsonString, schema);
    } else {
      result = parseJSON(jsonString);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

// Debug: list registered routes on startup (safe guard)
const listRoutes = () => {
  console.log('Registered routes:');
  if (!app._router || !app._router.stack) {
    console.log('No router stack available yet');
    return;
  }
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      console.log(`${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
          console.log(`${methods} ${handler.route.path}`);
        }
      });
    }
  });
};

listRoutes();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
