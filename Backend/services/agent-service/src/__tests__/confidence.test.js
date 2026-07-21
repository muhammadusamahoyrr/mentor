const {
  parseConfidence,
  resolveConfidence,
  dataFloor,
  isThinResult,
  LOW_PREFIX,
} = require('../agent/confidence');

// Regression: seen in the browser on 2026-07-21. The model wrote
// "Confidence: Medium (guidelines differ on thresholds…)" as prose. The old
// pattern only allowed trailing dots/spaces after the level, so it did not
// match — the sentence stayed in the answer and sat directly above the
// confidence badge saying the same thing.
describe('a prose confidence line with a trailing explanation', () => {
  it('strips the whole line, not just a bare marker', () => {
    const { level, answer } = parseConfidence(
      'Guidelines differ between bodies.\n\nConfidence: Medium (guidelines differ on thresholds and risk-based triggers)'
    );
    expect(level).toBe('medium');
    expect(answer).toBe('Guidelines differ between bodies.');
    expect(answer).not.toMatch(/Confidence/i);
  });

  it('leaves prose that merely mentions confidence alone', () => {
    const text = 'Confidence intervals were wide in that trial.';
    expect(parseConfidence(text)).toEqual({ level: null, answer: text });
  });
});

describe('parseConfidence', () => {
  it('extracts and strips a trailing CONFIDENCE line', () => {
    const { level, answer } = parseConfidence('The BP target is <140/90.\nCONFIDENCE: high');
    expect(level).toBe('high');
    expect(answer).toBe('The BP target is <140/90.');
    expect(answer).not.toMatch(/CONFIDENCE/);
  });

  it('returns null level when there is no marker', () => {
    expect(parseConfidence('just an answer').level).toBeNull();
  });
});

describe('grounding floor', () => {
  it('forces low when retrieve_docs was used but returned nothing', () => {
    expect(dataFloor([{ name: 'retrieve_docs', thin: true }])).toBe('low');
    expect(resolveConfidence('high', [{ name: 'retrieve_docs', thin: true }])).toBe('low');
  });

  it('does not force low when retrieval actually returned data', () => {
    expect(resolveConfidence('high', [{ name: 'retrieve_docs', thin: false }])).toBe('high');
  });

  it('takes the more cautious of model vs grounding', () => {
    expect(resolveConfidence('low', [])).toBe('low'); // model cautious
    expect(resolveConfidence('high', [])).toBe('high'); // nothing forces it down
    expect(resolveConfidence('medium', [{ name: 'retrieve_docs', thin: true }])).toBe('low');
  });
});

describe('isThinResult', () => {
  it('treats empty retrieval / search / errors as thin', () => {
    expect(isThinResult('retrieve_docs', { count: 0 })).toBe(true);
    expect(isThinResult('retrieve_docs', { count: 3 })).toBe(false);
    expect(isThinResult('web_search', { count: 0 })).toBe(true);
    expect(isThinResult('read_patient_file', { error: 'boom' })).toBe(true);
    expect(isThinResult('read_patient_file', { text: 'ok' })).toBe(false);
  });
});

it('LOW_PREFIX is the verify-with-doctor notice', () => {
  expect(LOW_PREFIX).toMatch(/verify with the doctor/i);
});
