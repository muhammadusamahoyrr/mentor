// The structured-output guardrail. The point of the trailer is that the machine
// -readable part is VALIDATED — a malformed one must be caught, not silently
// passed through as if the model had complied.
const { parseAnswer, splitTrailer, repairMessages, AgentMetaSchema } = require('../agent/answerSchema');

const VALID =
  'Lisinopril can cause a dry cough.\n' +
  'AGENT_META: {"sources":[{"title":"NICE NG136","ref":"https://example.org/ng136"}],"confidence":"high"}';

describe('splitTrailer', () => {
  it('separates the prose from the trailer JSON', () => {
    const { answer, raw } = splitTrailer(VALID);
    expect(answer).toBe('Lisinopril can cause a dry cough.');
    expect(JSON.parse(raw).confidence).toBe('high');
  });

  it('returns the whole text and no trailer when there is none', () => {
    const { answer, raw } = splitTrailer('Just prose.');
    expect(answer).toBe('Just prose.');
    expect(raw).toBeNull();
  });
});

describe('parseAnswer', () => {
  it('accepts a well-formed trailer and strips it from the visible answer', () => {
    const { answer, meta, ok } = parseAnswer(VALID);
    expect(ok).toBe(true);
    expect(answer).toBe('Lisinopril can cause a dry cough.');
    expect(meta.confidence).toBe('high');
    expect(meta.sources).toEqual([
      { title: 'NICE NG136', ref: 'https://example.org/ng136' },
    ]);
  });

  it('accepts an empty sources list (a synthesis with nothing cited)', () => {
    const { ok, meta } = parseAnswer('Text.\nAGENT_META: {"sources":[],"confidence":"low"}');
    expect(ok).toBe(true);
    expect(meta.sources).toEqual([]);
  });

  it('reports a missing trailer rather than inventing one', () => {
    const { ok, error, meta, answer } = parseAnswer('No trailer here.');
    expect(ok).toBe(false);
    expect(meta).toBeNull();
    expect(error).toBe('no trailer');
    expect(answer).toBe('No trailer here.'); // prose still usable
  });

  it('rejects a trailer that is not valid JSON', () => {
    const { ok, error } = parseAnswer('Text.\nAGENT_META: {not json}');
    expect(ok).toBe(false);
    expect(error).toMatch(/not JSON/);
  });

  it('rejects an invented confidence level', () => {
    const { ok, error } = parseAnswer(
      'Text.\nAGENT_META: {"sources":[],"confidence":"extremely-sure"}'
    );
    expect(ok).toBe(false);
    expect(error).toMatch(/confidence/);
  });

  it('rejects a source missing its ref', () => {
    const { ok, error } = parseAnswer(
      'Text.\nAGENT_META: {"sources":[{"title":"A"}],"confidence":"high"}'
    );
    expect(ok).toBe(false);
    expect(error).toMatch(/ref/);
  });

  it('strips the trailer even when the model pads it with whitespace', () => {
    const { ok, answer } = parseAnswer(
      'Body text.\n\n  AGENT_META: {"sources":[],"confidence":"medium"}   \n'
    );
    expect(ok).toBe(true);
    expect(answer).toBe('Body text.');
  });
});

describe('AgentMetaSchema', () => {
  it('defaults sources to [] when the key is absent', () => {
    const parsed = AgentMetaSchema.safeParse({ confidence: 'medium' });
    expect(parsed.success).toBe(true);
    expect(parsed.data.sources).toEqual([]);
  });
});

describe('repairMessages', () => {
  it('asks for the trailer alone, quoting the answer and the failure', () => {
    const [msg] = repairMessages('The answer.', 'no trailer');
    expect(msg.role).toBe('user');
    expect(msg.content).toContain('The answer.');
    expect(msg.content).toContain('no trailer');
    expect(msg.content).toContain('AGENT_META:');
  });
});
