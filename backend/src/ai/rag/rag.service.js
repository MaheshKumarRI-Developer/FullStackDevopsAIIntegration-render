const { searchSimilar, DEFAULT_COLLECTION } = require("../retrieval/retrieval.service");
const { buildContextFromDocuments } = require("../context/context.builder");
const { buildRagPrompt } = require("../prompts/ragPrompt");
const groqProvider = require("../providers/groqProvider");

function normalizeSearchResults(searchResults) {
  if (Array.isArray(searchResults)) {
    return searchResults;
  }

  if (searchResults && Array.isArray(searchResults.result)) {
    return searchResults.result;
  }

  if (searchResults && Array.isArray(searchResults.hits)) {
    return searchResults.hits;
  }

  return [];
}

async function retrieve(question, limit = 10, filter = null, collectionName = DEFAULT_COLLECTION) {
  const searchResults = await searchSimilar({
    query: question,
    limit,
    filter,
    collectionName,
  });

  return normalizeSearchResults(searchResults);
}

function buildContext(documents, title = "Relevant Vulnerabilities") {
  return buildContextFromDocuments(documents, title);
}

async function buildContextPackage(question, options = {}) {
  const {
    limit = 10,
    filter = null,
    collectionName = DEFAULT_COLLECTION,
    title = "Relevant Vulnerabilities",
  } = options;

  const documents = await retrieve(question, limit, filter, collectionName);
  const context = buildContext(documents, title);

  return {
    question,
    context,
    documents,
  };
}

function buildPrompt(question, context) {
  return buildRagPrompt(question, context);
}

async function generateAnswer(question, context, options = {}) {
  const messages = buildPrompt(question, context);
  const response = await groqProvider.createChatCompletion(messages, {
    temperature: options.temperature ?? 0.2,
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

async function answerQuestion(question, options = {}) {
  const {
    limit = 10,
    filter = null,
    collectionName = DEFAULT_COLLECTION,
    title = "Relevant Vulnerabilities",
  } = options;

  const documents = await retrieve(question, limit, filter, collectionName);
  const context = buildContext(documents, title);
  const answer = await generateAnswer(question, context, options);

  return {
    question,
    context,
    answer,
    documents,
  };
}

module.exports = {
  retrieve,
  buildContext,
  buildContextPackage,
  buildPrompt,
  generateAnswer,
  answerQuestion,
};
