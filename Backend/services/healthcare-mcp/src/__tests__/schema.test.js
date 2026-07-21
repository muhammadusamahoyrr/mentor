// The JSON Schema -> Zod translation at the SDK boundary. Our skills author their
// schemas in JSON Schema (the Anthropic/Gemini tool format); this proves the
// translation preserves types, optionality and required-ness rather than quietly
// accepting anything.
const { z } = require('zod');
const { toZodShape } = require('../schema');
const platform = require('../../../../shared/agent/tools/registry');

const asObject = (shape) => z.object(shape);

describe('toZodShape', () => {
  it('marks required properties required and the rest optional', () => {
    const shape = toZodShape({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
      required: ['a'],
    });
    const schema = asObject(shape);

    expect(schema.safeParse({ a: 'x' }).success).toBe(true);
    expect(schema.safeParse({ a: 'x', b: 'y' }).success).toBe(true);
    expect(schema.safeParse({ b: 'y' }).success).toBe(false); // missing required `a`
  });

  it('enforces types, including integer vs number', () => {
    const schema = asObject(
      toZodShape({
        type: 'object',
        properties: { s: { type: 'string' }, n: { type: 'integer' } },
        required: ['s', 'n'],
      })
    );

    expect(schema.safeParse({ s: 'x', n: 3 }).success).toBe(true);
    expect(schema.safeParse({ s: 'x', n: 3.5 }).success).toBe(false); // not an integer
    expect(schema.safeParse({ s: 5, n: 3 }).success).toBe(false); // wrong type
  });

  it('handles a tool with no parameters', () => {
    expect(toZodShape({ type: 'object', properties: {}, required: [] })).toEqual({});
  });

  it('carries descriptions through (they are what the model reads)', () => {
    const shape = toZodShape({
      type: 'object',
      properties: { q: { type: 'string', description: 'The search query.' } },
      required: ['q'],
    });
    expect(shape.q.description).toBe('The search query.');
  });

  it('throws loudly on a schema construct it does not support', () => {
    expect(() =>
      toZodShape({ type: 'object', properties: { weird: { type: 'null' } }, required: [] })
    ).toThrow(/Unsupported JSON Schema type/);
  });

  it('refuses a non-object top-level schema', () => {
    expect(() => toZodShape({ type: 'string' })).toThrow(/must be an object schema/);
  });

  it('translates every real platform skill without throwing', () => {
    for (const skill of platform.skills) {
      expect(() => toZodShape(skill.definition.input_schema)).not.toThrow();
    }
  });
});
