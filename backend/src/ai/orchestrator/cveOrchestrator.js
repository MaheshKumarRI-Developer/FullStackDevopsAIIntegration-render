const groqProvider = require("../providers/groqProvider");
const {
  buildVulnerabilityPrompt,
  buildRemediationPrompt,
  buildRiskAssessmentPrompt,
  buildOrchestratorSummaryPrompt,
} = require("../prompts/vulnerabilityPrompt");
const { parseJSON } = require("../parsers/jsonParser");
const {
  validateAgainstSchema,
  vulnerabilityAnalysisSchema,
  remediationSchema,
  riskAssessmentSchema,
  orchestratorSummarySchema,
} = require("../schemas");

async function runStructuredAi(messages, schema) {
  const result = await groqProvider.createChatCompletion(messages, {
    temperature: 0.2,
    responseFormat: { type: "json_object" },
  });
  const content = result.choices?.[0]?.message?.content || "";
  const parsed = parseJSON(content);
  const validation = validateAgainstSchema(parsed, schema);

  if (!validation.valid) {
    const error = new Error("AI response did not match the expected schema.");
    error.validation = validation;
    error.parsed = parsed;
    throw error;
  }

  return validation.data;
}

async function runWorkflowStep(name, task) {
  const startedAt = new Date().toISOString();

  try {
    const data = await task();
    return {
      name,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      data,
    };
  } catch (error) {
    return {
      name,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      error: error.message,
      validation: error.validation,
      parsed: error.parsed,
    };
  }
}

function getStepData(step) {
  return step.status === "completed" ? step.data : null;
}

async function runCveOrchestrator(cveData) {
  const workflowId = `cve-workflow-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const steps = [];

  const analysisStep = await runWorkflowStep("vulnerability-analysis", () =>
    runStructuredAi(buildVulnerabilityPrompt(cveData), vulnerabilityAnalysisSchema)
  );
  steps.push(analysisStep);

  const riskStep = await runWorkflowStep("risk-assessment", () =>
    runStructuredAi(buildRiskAssessmentPrompt(cveData), riskAssessmentSchema)
  );
  steps.push(riskStep);

  const remediationStep = await runWorkflowStep("remediation-planning", () =>
    runStructuredAi(buildRemediationPrompt(cveData), remediationSchema)
  );
  steps.push(remediationStep);

  const outputs = {
    analysis: getStepData(analysisStep),
    riskAssessment: getStepData(riskStep),
    remediation: getStepData(remediationStep),
  };

  const summaryStep = await runWorkflowStep("orchestrator-summary", () =>
    runStructuredAi(buildOrchestratorSummaryPrompt(cveData, outputs), orchestratorSummarySchema)
  );
  steps.push(summaryStep);

  const failedSteps = steps.filter((step) => step.status === "failed");

  return {
    workflowId,
    status: failedSteps.length === 0 ? "completed" : "partial",
    provider: "groq",
    model: groqProvider.GROQ_MODEL,
    startedAt,
    completedAt: new Date().toISOString(),
    outputs: {
      ...outputs,
      summary: getStepData(summaryStep),
    },
    steps: steps.map(({ data, ...step }) => step),
  };
}

module.exports = {
  runCveOrchestrator,
};
