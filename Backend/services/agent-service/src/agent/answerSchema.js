// The structured-output guardrail — a validated TRAILER, not a full-JSON answer.
//
// Why not ask the model for JSON for the whole reply? Because the panel streams
// tokens as they arrive, and you cannot stream half-formed JSON: the doctor would
// stare at a spinner until the object closed, and the typing caret UX would be
// gone. So the prose streams exactly as before, and the model appends one compact
// machine-readable line at the very end:
//
//   AGENT_META: {"sources":[{"title":"NICE NG136","ref":"https://..."}],"confidence":"high"}
//
// That line is stripped from the visible answer (see markerFilter in loop.js),
// parsed, and validated with Zod — the same validation approach notes-service
// uses for its request bodies. If the model gets it wrong we ask once more for
// just the trailer; if it still fails we fall back to the plain CONFIDENCE line
// rather than failing the doctor's question.
const { z } = require('zod');

// A citation the doctor can actually follow up: what it was, and where it came
// from (a URL for web results, a filename/id for a patient document).
//
// The `ref` refinement rejects ABBREVIATED urls. Models like to shorten a long
// link to `https://reference.medscape.com/cc2/p10/...`, which renders as a
// clickable link that goes nowhere — worse than citing nothing, because it looks
// verifiable. Failing validation here makes the repair retry ask for it again.
const SourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  ref: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((v) => !/(\.\.\.|…)/.test(v), {
      message: 'ref looks truncated (contains "..." or "…") — give the complete URL or id',
    }),
});

const AgentMetaSchema = z.object({
  sources: z.array(SourceSchema).max(20).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
});

const TRAILER_PREFIX = 'AGENT_META:';

// The trailer is the LAST thing in the answer. Non-greedy up to a final closing
// brace so trailing whitespace or a stray newline can't defeat the match.
const TRAILER_RE = /\n?\s*AGENT_META:\s*(\{[\s\S]*\})\s*$/;

/**
 * Split a raw model answer into visible prose and its raw trailer JSON.
 *
 * ⚠️ The marker must be stripped even when the JSON is unusable. A long answer
 * can exhaust max_tokens PART-WAY THROUGH the trailer, leaving something like
 * `AGENT_META: {"sources":[{"title":"Reuters","ref":"` with no closing brace.
 * The strict pattern cannot match that, and an earlier version then treated the
 * whole thing as prose — so the doctor saw raw JSON pasted onto their answer.
 * Parsing and hiding are separate jobs: we may fail to parse it, but we must
 * always hide it.
 *
 * @returns {{ answer: string, raw: string|null, truncated: boolean }}
 */
function splitTrailer(text) {
  const s = String(text || '');

  const m = s.match(TRAILER_RE);
  if (m) return { answer: s.slice(0, m.index).trim(), raw: m[1], truncated: false };

  // No well-formed trailer. If the marker is there at all, cut from it anyway.
  const i = s.lastIndexOf(TRAILER_PREFIX);
  if (i !== -1) return { answer: s.slice(0, i).trim(), raw: null, truncated: true };

  return { answer: s.trim(), raw: null, truncated: false };
}

/**
 * Parse + validate the trailer off a raw answer.
 *
 * @returns {{ answer, meta: {sources, confidence}|null, ok: boolean, error: string|null }}
 *   `ok` is false when a trailer was absent OR present but invalid — either way
 *   the caller may attempt one repair.
 */
function parseAnswer(text) {
  const { answer, raw, truncated } = splitTrailer(text);
  if (raw === null) {
    // `answer` already has the marker stripped when it was there but unusable.
    return {
      answer,
      meta: null,
      ok: false,
      error: truncated ? 'trailer truncated or malformed' : 'no trailer',
    };
  }

  let candidate;
  try {
    candidate = JSON.parse(raw);
  } catch (err) {
    return { answer, meta: null, ok: false, error: `trailer is not JSON: ${err.message}` };
  }

  const parsed = AgentMetaSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      answer,
      meta: null,
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    };
  }

  return { answer, meta: parsed.data, ok: true, error: null };
}

// The one repair attempt: hand the model back its own answer and ask for nothing
// but the trailer. Deliberately not a full re-run — we already have the prose and
// only the machine-readable part failed.
function repairMessages(answer, error) {
  return [
    {
      role: 'user',
      content:
        `Here is an answer you produced:\n\n${answer}\n\n` +
        `Its ${TRAILER_PREFIX} trailer was missing or invalid (${error}).\n` +
        `Reply with ONE line and nothing else, in exactly this form:\n` +
        `${TRAILER_PREFIX} {"sources":[{"title":"...","ref":"..."}],"confidence":"high|medium|low"}\n\n` +
        `List only sources actually used in that answer; use [] if there were none. ` +
        `No prose, no code fence.`,
    },
  ];
}

module.exports = {
  AgentMetaSchema,
  SourceSchema,
  TRAILER_PREFIX,
  TRAILER_RE,
  splitTrailer,
  parseAnswer,
  repairMessages,
};
