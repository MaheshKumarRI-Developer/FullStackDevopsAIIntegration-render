function buildRagPrompt(question, context) {
  const systemMessage = {
    role: "system",
    content: "You are a cybersecurity assistant. Use only the provided context to answer the user's question. Do not hallucinate or invent details. Choose the single most relevant vulnerability from the context and answer based on that item.",
  };

  const userMessage = {
    role: "user",
    content: `Context:\n${context}\n\nQuestion:\n${question}\n\nAnswer using only the provided context. If the question asks about a specific issue, identify the matching vulnerability code and issue from the context.`,
  };

  return [systemMessage, userMessage];
}

module.exports = {
  buildRagPrompt,
};
