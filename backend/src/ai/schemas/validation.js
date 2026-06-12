function validateType(value, expectedType, path = "") {
  const type = typeof value;
  const location = path || "root";

  if (expectedType === "string") {
    return { valid: type === "string", message: validMessage(type, expectedType, location) };
  }

  if (expectedType === "number") {
    return { valid: type === "number" && !Number.isNaN(value), message: validMessage(type, expectedType, location) };
  }

  if (expectedType === "boolean") {
    return { valid: type === "boolean", message: validMessage(type, expectedType, location) };
  }

  if (expectedType === "array") {
    return { valid: Array.isArray(value), message: validMessage(Array.isArray(value) ? "array" : type, expectedType, location) };
  }

  if (expectedType === "object") {
    return { valid: type === "object" && value !== null && !Array.isArray(value), message: validMessage(type, expectedType, location) };
  }

  if (typeof expectedType === "object" && expectedType !== null && !Array.isArray(expectedType)) {
    if (type !== "object" || value === null || Array.isArray(value)) {
      return { valid: false, message: validMessage(type, "object", location) };
    }
    const nestedResult = validateAgainstSchema(value, expectedType, path);
    return { valid: nestedResult.valid, message: nestedResult.errors.join("; ") };
  }

  return { valid: false, message: `Unsupported expected type '${expectedType}' at ${location}` };
}

function validMessage(actualType, expectedType, location) {
  return `Expected '${expectedType}' at ${location}, got '${actualType}'`;
}

function validateAgainstSchema(data, schema, path = "") {
  const errors = [];
  const validated = {};

  for (const [key, expectedType] of Object.entries(schema)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      errors.push(`Missing required field '${currentPath}'`);
      validated[key] = null;
      continue;
    }

    const value = data[key];
    const { valid, message } = validateType(value, expectedType, currentPath);

    if (!valid) {
      errors.push(message);
      validated[key] = null;
    } else {
      validated[key] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: validated,
  };
}

module.exports = {
  validateAgainstSchema,
};
