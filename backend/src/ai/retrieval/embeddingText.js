function buildVulnerabilityEmbeddingText(vulnerability) {
  const {
    asset = "N/A",
    code = "N/A",
    message = "N/A",
    severity = "UNKNOWN",
  } = vulnerability;

  return [
    `Asset: ${asset}`,
    `Vulnerability Code: ${code}`,
    `Issue: ${message}`,
    `Severity: ${severity}`,
  ].join("\n");
}

module.exports = {
  buildVulnerabilityEmbeddingText,
};
