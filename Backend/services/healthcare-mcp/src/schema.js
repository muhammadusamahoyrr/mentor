// JSON Schema -> Zod raw shape, at the SDK boundary.
//
// Our skill definitions carry `input_schema` in JSON Schema form because that is
// the format the Anthropic/Gemini tool APIs take, and the ReAct loop feeds the
// very same objects to the model. The MCP SDK's high-level `registerTool` wants
// Zod instead (it converts back to JSON Schema for the wire), so we translate
// here rather than maintain a second copy of every schema.
//
// Deliberately small: it covers exactly the constructs our skills use (an object
// of string/integer/number/boolean/array properties, with `required` and
// `description`) and throws on anything else, so an unsupported schema fails
// loudly at startup instead of silently accepting the wrong input at runtime.
const { z } = require('zod');

function leaf(prop, name) {
  const withDescription = (schema) =>
    prop.description ? schema.describe(prop.description) : schema;

  switch (prop.type) {
    case 'string':
      return withDescription(z.string());
    case 'integer':
      return withDescription(z.number().int());
    case 'number':
      return withDescription(z.number());
    case 'boolean':
      return withDescription(z.boolean());
    case 'array':
      return withDescription(z.array(prop.items ? leaf(prop.items, name) : z.unknown()));
    default:
      throw new Error(
        `Unsupported JSON Schema type "${prop.type}" for property "${name}" — extend schema.js`
      );
  }
}

/**
 * @param {object} inputSchema  a JSON Schema object ({type:'object', properties, required})
 * @returns {object} a Zod raw shape — { propName: ZodType } — for registerTool
 */
function toZodShape(inputSchema = {}) {
  if (inputSchema.type !== 'object') {
    throw new Error(`Tool input_schema must be an object schema, got "${inputSchema.type}"`);
  }
  const required = new Set(inputSchema.required || []);
  const shape = {};
  for (const [name, prop] of Object.entries(inputSchema.properties || {})) {
    const zodType = leaf(prop, name);
    shape[name] = required.has(name) ? zodType : zodType.optional();
  }
  return shape; // {} is valid — a tool with no parameters (e.g. list_patient_files)
}

module.exports = { toZodShape };
