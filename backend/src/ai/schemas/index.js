const vulnerabilityAnalysisSchema = {
  summary: "string",
  impact: "string",
  mitigationSteps: "array",
  severity: "string",
  recommendations: "string",
};

const remediationSchema = {
  cveId: "string",
  remediationSteps: "array",
  patchStrategy: "string",
  deploymentAdvice: "string",
};

const riskAssessmentSchema = {
  cveId: "string",
  riskScore: "number",
  likelihood: "string",
  businessImpact: "string",
  exploitability: "string",
};

const orchestratorSummarySchema = {
  executiveSummary: "string",
  priority: "string",
  immediateActions: "array",
  ownerGuidance: "string",
  validationNotes: "array",
};

const { validateAgainstSchema } = require("./validation");

module.exports = {
  vulnerabilityAnalysisSchema,
  remediationSchema,
  riskAssessmentSchema,
  orchestratorSummarySchema,
  validateAgainstSchema,
};
