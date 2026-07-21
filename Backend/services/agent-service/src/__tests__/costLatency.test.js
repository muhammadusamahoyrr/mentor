// Token accounting, the serial-vs-parallel measurement, and the routing eval
// scorer (week5.md §4.6 and §5). All driven with fake models — the point is that
// the MEASUREMENT logic is correct and testable without spending real quota.
const {
  readUsage,
  addUsage,
  mergeUsage,
  emptyUsage,
  summarize,
} = require('../agent/providers/usage');
const { compare, formatReport, runOnce } = require('../agent/orchestration/benchmark');
const { CASES, score, isCorrect } = require('../agent/orchestration/routingEval');

describe('token accounting across providers', () => {
  it('reads the Anthropic shape', () => {
    expect(readUsage({ usage: { input_tokens: 10, output_tokens: 4 } })).toEqual({
      inputTokens: 10,
      outputTokens: 4,
    });
  });

  it('reads the OpenAI/OpenRouter shape', () => {
    expect(readUsage({ usage: { prompt_tokens: 7, completion_tokens: 3 } })).toEqual({
      inputTokens: 7,
      outputTokens: 3,
    });
  });

  it('reads the Gemini shape', () => {
    expect(readUsage({ usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } })).toEqual({
      inputTokens: 5,
      outputTokens: 2,
    });
  });

  it('returns null when the provider said nothing', () => {
    expect(readUsage({})).toBeNull();
    expect(readUsage({ usage: {} })).toBeNull();
    expect(readUsage(undefined)).toBeNull();
  });

  it('counts every call but only the ones that reported', () => {
    const acc = emptyUsage();
    addUsage(acc, { usage: { input_tokens: 10, output_tokens: 5 } });
    addUsage(acc, {}); // provider withheld usage
    expect(acc).toMatchObject({ calls: 2, reported: 1, inputTokens: 10, outputTokens: 5 });
  });

  it('marks the total INCOMPLETE when any call withheld usage — it is a floor', () => {
    // This is the honesty guard: a partial total must never be quoted as exact.
    const acc = emptyUsage();
    addUsage(acc, { usage: { input_tokens: 10, output_tokens: 5 } });
    addUsage(acc, {});
    const s = summarize(acc);
    expect(s.totalTokens).toBe(15);
    expect(s.complete).toBe(false);
  });

  it('marks it complete when every call reported', () => {
    const acc = emptyUsage();
    addUsage(acc, { usage: { input_tokens: 1, output_tokens: 1 } });
    addUsage(acc, { usage: { input_tokens: 2, output_tokens: 2 } });
    expect(summarize(acc).complete).toBe(true);
  });

  it('merges a supervisor with its workers', () => {
    const a = emptyUsage();
    addUsage(a, { usage: { input_tokens: 10, output_tokens: 5 } });
    const b = emptyUsage();
    addUsage(b, { usage: { input_tokens: 20, output_tokens: 10 } });

    expect(summarize(mergeUsage(a, b))).toMatchObject({
      inputTokens: 30,
      outputTokens: 15,
      totalTokens: 45,
      calls: 2,
      complete: true,
    });
  });
});

describe('the loop reports its token usage', () => {
  const { runAgent } = require('../agent/loop');

  const fakeGateway = {
    kind: 'fake',
    definitions: [],
    call: async () => ({}),
    close() {},
  };

  it('accumulates usage across the run', async () => {
    const client = {
      messages: {
        create: async () => ({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'done' }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      },
    };

    const result = await runAgent({ question: 'q', client, tools: fakeGateway });
    expect(result.usage).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      calls: 1,
      complete: true,
    });
  });

  it('still returns a usage block when the provider reports nothing', async () => {
    const client = {
      messages: {
        create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'x' }] }),
      },
    };

    const result = await runAgent({ question: 'q', client, tools: fakeGateway });
    expect(result.usage).toMatchObject({ calls: 1, reported: 0, totalTokens: 0, complete: false });
  });
});

describe('serial-vs-parallel comparison', () => {
  it('computes the parallel speedup', () => {
    const c = compare([
      { mode: 'sequential', ms: 1000, calls: 4, totalTokens: 800, steps: 3, tokensComplete: true },
      { mode: 'parallel', ms: 500, calls: 4, totalTokens: 800, steps: 3, tokensComplete: true },
    ]);
    expect(c.parallelSpeedup).toBe(2);
    expect(c.msSaved).toBe(500);
  });

  it('reports what orchestration COSTS versus a single agent', () => {
    // The honest direction: for a simple question this is usually > 1, because
    // routing and composition are extra round trips.
    const c = compare([
      { mode: 'single', ms: 400, calls: 2, totalTokens: 300, steps: 2, tokensComplete: true },
      { mode: 'parallel', ms: 900, calls: 5, totalTokens: 1200, steps: 4, tokensComplete: true },
    ]);
    expect(c.orchestrationLatencyCost).toBe(2.25);
    expect(c.extraCalls).toBe(3);
    expect(c.tokenCost).toBe(4);
  });

  it('flags when the token figures are only a floor', () => {
    const c = compare([
      { mode: 'single', ms: 1, calls: 1, totalTokens: 0, steps: 1, tokensComplete: false },
    ]);
    expect(c.tokensAreComplete).toBe(false);
  });

  it('survives a mode that failed outright', () => {
    const c = compare([
      { mode: 'single', ms: 100, calls: 1, totalTokens: 10, steps: 1, tokensComplete: true },
      { mode: 'parallel', failed: true, error: 'rate limited' },
    ]);
    expect(c.orchestrationLatencyCost).toBeUndefined(); // nothing to compare against
  });

  it('renders a readable table, marking incomplete token counts with +', () => {
    const text = formatReport({
      question: 'test q',
      runs: [
        { mode: 'single', ms: 400, calls: 2, totalTokens: 300, steps: 2, workers: [], tokensComplete: false },
        {
          mode: 'parallel',
          ms: 900,
          calls: 5,
          totalTokens: 1200,
          steps: 4,
          workers: ['records', 'research'],
          tokensComplete: false,
        },
      ],
      comparison: { orchestrationLatencyCost: 2.25, extraCalls: 3, tokensAreComplete: false },
    });

    expect(text).toContain('test q');
    expect(text).toContain('records+research');
    expect(text).toContain('300+'); // the floor marker
    expect(text).toMatch(/tokens are a floor/i);
  });

  it('measures a real single-agent run end to end', async () => {
    const client = {
      messages: {
        stream: () => ({
          on(e, cb) {
            if (e === 'text') cb('answer');
            return this;
          },
          finalMessage: async () => ({
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'answer' }],
            usage: { input_tokens: 50, output_tokens: 10 },
          }),
        }),
      },
    };

    const run = await runOnce({
      mode: 'single',
      question: 'q',
      client,
      tools: { kind: 'fake', definitions: [], call: async () => ({}), close() {} },
    });

    expect(run.mode).toBe('single');
    expect(run.calls).toBe(1);
    expect(run.totalTokens).toBe(60);
    expect(run.tokensComplete).toBe(true);
    expect(typeof run.ms).toBe('number');
  });
});

describe('routing eval set', () => {
  it('has enough cases to be meaningful (§5 asks for 10–15)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(10);
    expect(CASES.length).toBeLessThanOrEqual(20);
  });

  it('only expects workers that actually exist', () => {
    const workers = require('../agent/orchestration/workers');
    for (const c of CASES) {
      for (const w of c.expected) expect(workers.NAMES).toContain(w);
      for (const alt of c.accepted || []) {
        for (const w of alt) expect(workers.NAMES).toContain(w);
      }
    }
  });

  it('covers every worker and includes multi-worker cases', () => {
    const all = CASES.flatMap((c) => c.expected);
    expect(new Set(all)).toEqual(new Set(['records', 'research', 'scheduling']));
    expect(CASES.some((c) => c.expected.length > 1)).toBe(true);
  });

  it('scores an exact match as correct, order-insensitively', () => {
    const c = { question: 'q', expected: ['records', 'research'] };
    expect(isCorrect(c, ['research', 'records'])).toBe(true);
  });

  it('accepts a defensible alternative when one is listed', () => {
    const c = { question: 'q', expected: ['records'], accepted: [['records', 'scheduling']] };
    expect(isCorrect(c, ['scheduling', 'records'])).toBe(true);
    expect(isCorrect(c, ['research'])).toBe(false);
  });

  it('reports accuracy and lists the misroutes', () => {
    const report = score([
      { testCase: { question: 'a', expected: ['research'] }, actual: ['research'] },
      { testCase: { question: 'b', expected: ['records'] }, actual: ['research'] },
      { testCase: { question: 'c', expected: ['records'] }, actual: [], error: 'unparseable' },
    ]);

    expect(report).toMatchObject({ total: 3, correct: 1, accuracy: 0.333 });
    expect(report.misses).toHaveLength(2);
    expect(report.misses[1].actual).toMatch(/ERROR/);
  });
});
