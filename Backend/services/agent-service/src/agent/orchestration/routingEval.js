// The routing eval set (week5.md §5): question -> which worker SHOULD handle it.
//
// ⚠️ REPORT THE NUMBER, DON'T ASSERT IT. Routing accuracy is a property of the
// model, not of our code, so making it a pass/fail test would mean a CI failure
// every time a provider changed its mind. The dataset and the scoring live here
// and are unit-tested; the accuracy figure comes from running
// `npm run eval:routing` against a real model.
//
// `expected` is the set of workers a good router would pick. Where two are
// defensible, list both — `accepted` marks a routing correct if it matches ANY
// of them, so the score measures real mistakes rather than taste.

const CASES = [
  // --- research: general medical knowledge, no patient involved --------------
  {
    question: 'What do current guidelines say about managing Stage 1 hypertension?',
    expected: ['research'],
  },
  {
    question: 'Summarise recent evidence on lisinopril side effects, with sources.',
    expected: ['research'],
  },
  {
    question: 'What is the first-line treatment for community-acquired pneumonia?',
    expected: ['research'],
  },
  {
    question: 'Find recent literature on managing type 2 diabetes.',
    expected: ['research'],
  },
  {
    question: 'Is metformin safe in stage 3 chronic kidney disease?',
    expected: ['research'],
  },

  // --- records: this patient's own documents --------------------------------
  {
    question: 'List the documents my patients have shared with me.',
    expected: ['records'],
  },
  {
    question: "What was the sodium level in patient p7's most recent lab report?",
    expected: ['records'],
  },
  {
    question: "Summarise what patient p3's uploaded discharge summary says.",
    expected: ['records'],
  },
  {
    question: "Search patient p1's records for anything about chest pain.",
    expected: ['records'],
  },

  // --- scheduling: a specific appointment ------------------------------------
  {
    question: 'What time is appointment a42 scheduled for?',
    expected: ['scheduling'],
  },
  {
    question: 'Who are the participants in appointment a19, and is it still booked?',
    expected: ['scheduling'],
  },

  // --- genuinely two-worker questions ---------------------------------------
  {
    question:
      "Compare patient p7's latest HbA1c against what current guidelines recommend.",
    expected: ['records', 'research'],
  },
  {
    question:
      "Patient p2's report mentions a drug interaction — check the record and what the literature says.",
    expected: ['records', 'research'],
  },

  // --- ambiguous on purpose: more than one answer is defensible --------------
  {
    question: 'Is my 3pm patient on any medication that interacts with warfarin?',
    // Without an appointment id, records alone is reasonable; pulling scheduling
    // in to resolve "3pm" is also reasonable.
    expected: ['records'],
    accepted: [['records'], ['records', 'scheduling'], ['scheduling', 'records']],
  },
  {
    question: 'Prepare me for appointment a8 with the relevant background.',
    expected: ['scheduling', 'records'],
    accepted: [['scheduling'], ['scheduling', 'records'], ['records', 'scheduling']],
  },
];

const key = (workers) => [...workers].map((w) => String(w).toLowerCase()).sort().join('+');

/**
 * Was this routing acceptable?
 * Correct if it equals `expected`, or matches any entry in `accepted`.
 */
function isCorrect(testCase, actualWorkers) {
  const actual = key(actualWorkers);
  if (actual === key(testCase.expected)) return true;
  return (testCase.accepted || []).some((alt) => key(alt) === actual);
}

/**
 * Score a set of {case, actual} results.
 * @returns {{total, correct, accuracy, misses: []}}
 */
function score(results) {
  const misses = [];
  let correct = 0;

  for (const { testCase, actual, error } of results) {
    if (!error && isCorrect(testCase, actual)) {
      correct += 1;
    } else {
      misses.push({
        question: testCase.question,
        expected: testCase.expected,
        actual: error ? `ERROR: ${error}` : actual,
      });
    }
  }

  const total = results.length;
  return {
    total,
    correct,
    accuracy: total ? Number((correct / total).toFixed(3)) : 0,
    misses,
  };
}

module.exports = { CASES, score, isCorrect };
