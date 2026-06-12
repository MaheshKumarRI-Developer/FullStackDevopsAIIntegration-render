function normalizeDocument(document, index) {
  const code = document.code || document.payload?.code || document.id || `unknown-${index + 1}`;
  const severity = document.severity || document.payload?.severity || "UNKNOWN";
  const issue = document.message || document.issue || document.description || document.payload?.message || document.payload?.text || "No issue description provided.";

  return {
    code,
    severity,
    issue,
  };
}

function buildContextFromDocuments(documents, title = "Relevant Vulnerabilities") {
  if (!Array.isArray(documents) || documents.length === 0) {
    return `${title}\n\nNo relevant vulnerabilities were found.`;
  }

  const lines = [title, ""];
  const seen = new Set();

  documents.forEach((document, index) => {
    const { code, severity, issue } = normalizeDocument(document, index);
    const key = `${code}|${issue}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    lines.push(`Code: ${code}`);
    lines.push(`Severity: ${severity}`);
    lines.push(`Issue: ${issue}`);
    lines.push("");
  });

  return lines.join("\n").trim();
}

module.exports = {
  buildContextFromDocuments,
};
