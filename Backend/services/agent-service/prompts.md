# prompts.md — agent-service (Week 5 lead-in: hardening, conventions & planning)
**Intern:** Muhammad Usama
**Program:** Arbisoft AI-Focused Internship 2026
**Service:** `agent-service` (port 3007)

> The original Week-4 **build** of this service (the ReAct loop, skills, hook, memory,
> vector recall, verification layer) is logged as Prompts 25–40 in the root
> [`Backend/prompts.md`](../../prompts.md). This file continues from there: the prompts I
> used while **fixing, hardening and tidying** the agent-service going into Week 5 (MCP &
> orchestration). Numbering restarts at 1 for this file.

---

## The context (before I started)

Week 4 left `agent-service` working on **Claude**. Over the break I switched the default
provider to **Google Gemini** (free tier) to demo without an Anthropic bill. That one change
surfaced a chain of provider-integration bugs, and a mentor review flagged a few
file-convention and prompt-authoring issues. This half-week was about making the service
**correct, robust and conventional** before building the Week-5 MCP layer on top of it.

---

## Day 1 — The provider swap breaks function-calling

### Prompt 1
> The agent errors with `400 — Function call is missing a thought_signature in functionCall
> parts … position 2, list_patient_files`. Check and fix it.

**What I was doing:** debugging why a *multi-tool* question died on the second reasoning step
after switching to Gemini, while single-tool answers worked.

**What I learned:** Gemini 3 attaches an opaque **`thoughtSignature`** to every `functionCall`
it emits and **requires it echoed back verbatim** on that same part in the next turn. My
Anthropic↔Gemini translation layer rebuilt the call as `{ functionCall: { name, args } }` and
**dropped the signature**, so the follow-up turn (carrying the tool result) was rejected. The
fix has three parts: read the signature off the **raw candidate parts** (the `.functionCalls`
convenience getter omits it), thread it onto the `tool_use` block, and echo it back on the
outgoing `functionCall`. A provider-specific quirk, but the loop stays provider-agnostic
because all of it lives in `translate.js`/`gemini.js`.

### Prompt 2
> Now it throws a raw `429` JSON blob into the chat. Fix it (and pick a sensible model).

**What I was doing:** the multi-tool run now reached Gemini — and hit the **free-tier limit of
5 requests/minute** (one agent question makes several calls).

**What I learned:** two things. First, an agent **multiplies** rate-limit pressure — a ReAct
loop is N model calls, not one — so the free tier is genuinely tight for this workload. Second,
a raw SDK error dumped into a user-facing panel is unreadable; I added `cleanGeminiError()` to
parse the blob and surface a short message **with the retry hint** ("retry in ~Ns"). I chose a
friendly message over an automatic long backoff on purpose: a 55-second stall mid-stream is
worse UX than a clear "try again shortly."

### Prompt 3
> Now `404 — model gemini-2.5-flash is no longer available to new users`. Fix it.

**What I was doing:** a model I'd switched to had been restricted for new accounts.

**What I learned:** **don't trust the model list — probe it.** The list endpoint still *showed*
`gemini-2.5-flash`, but a real `generateContent` call returned 404. I scripted a quick
`generateContent` probe against candidate models and picked one that actually returned **200**
for my key (`gemini-3.5-flash`), noting `gemini-flash-latest` as a deprecation-proof alias.
Availability ≠ listed.

---

## Day 2 — The agent's UI

### Prompt 4
> Redesign the "Ask AI" panel — I want it to feel like a real product, using my existing
> (indigo) colours, not a floating card.

**What I was doing:** reworking the doctor-facing panel (`AgentPanel.tsx`) without touching the
streaming/SSE logic.

**What I learned:** keep the **transport logic frozen and only swap the presentation** — the
SSE frame parsing, tool events and session handling stayed byte-for-byte identical while I
turned the floating card into a right-docked, full-height sidebar (Claude-style full-width
messages, a streaming caret, and the tool timeline as a connected **vertical stepper**). The
one real trap was CSS: after the rewrite the panel rendered *off-screen*. It wasn't a logic
bug — the running **Tailwind build was stale** and hadn't generated my new utility classes
(`inset-y-0`, `sm:w-[430px]`), so the element fell back to static flow far down the page. A
dev-server restart regenerated the CSS and fixed it. New utilities need a fresh build.

### Prompt 5
> A brand-new doctor just sees an "Ask AI" button and has no idea what it does. How do I fix
> that?

**What I was doing:** a discoverability problem — the empty panel taught the user nothing.

**What I learned:** the standard fix is a **teaching empty state** — a one-line "what I do" plus
**clickable starter prompts** that run on click. The important detail was choosing prompts that
need **no hand-typed ids** (literature search, evidence summary, `list_patient_files`) so a
first-time doctor gets a *successful* result on the very first click. Letting them *see* it work
teaches capability faster than any description.

---

## Day 3 — Conventions & hygiene (a mentor review)

### Prompt 6
> Check the agent-service file structure against the other services — are the conventions right?
> Fix the divergences.

**What I was doing:** an adversarial review of the service's own layout, then aligning it.

**What I learned:** the service was clean but had four small divergences from its siblings, and
consistency is about *where a contributor looks for things*. I moved the tests `__tests__/` →
**`src/__tests__/`** (matching notes-service), moved the Kafka sink `hooks/auditSink.js` →
**`events/auditSink.js`** (every other service keeps Kafka in `events/`), and renamed the two
odd-one-out files — `_serviceUtil.js` → **`serviceClient.js`** (the only underscore-prefixed
file in the repo) and `providers/index.js` → **`providers/factory.js`** (the only barrel). The
fiddly part was that moving the tests changed directory depth, so every `../src/` import had to
become `../`, plus the `AGENT_DOCS_DIR`/fixture paths. Git tracked them all as renames, so no
history was lost.

### Prompt 7
> My mentor pointed out the prompt lives in a `.js` string. Should it be Markdown? Fix it.

**What I was doing:** separating the agent's **instruction text** from code.

**What I learned:** there are two different things here, and only one should move. **Tools**
(`webSearch.js`, etc.) run real code and are correctly `.js` in every framework. But a
**prompt** is instructions for the model, and the modern convention (Anthropic Agent Skills'
`SKILL.md`, MCP prompts) authors it as **Markdown**. So I extracted the system-prompt text into
`src/agent/systemPrompt.md` and turned `systemPrompt.js` into a thin loader that reads it and
keeps the per-language wrapper. This also sets up the Week-5 MCP **prompts** capability, where
prompt templates are served as first-class resources.

### Prompt 8
> The tests fail. Fix the issue.

**What I was doing:** chasing what looked like a pre-existing test failure.

**What I learned:** the failure was **hidden network access**. The api/sse suites mock
`@anthropic-ai/sdk` and expect a stubbed answer — but requiring `server.js` runs
`dotenv.config()`, which loads the real `GEMINI_API_KEY` from `.env`; `resolveProvider()` then
auto-picked **Gemini** and the tests silently called the **live API** (and 429'd). The fix is
one line — pin `AGENT_PROVIDER=anthropic` in `jest.setup.js` so the suites deterministically use
the mocked client. The rule I kept: **tests must never touch the network**, and an integration
test that "sometimes fails" is usually reaching out somewhere it shouldn't. (`dotenv` doesn't
override an already-set var, so the pin holds even after `server.js` loads `.env`.)

---

## Day 4 — Git hygiene & planning

### Prompt 9
> The commit messages don't follow a standard. Fix them.

**What I was doing:** bringing my commits up to a recognised standard.

**What I learned:** I applied **Conventional Commits** (`fix(agent):`, `refactor(agent):`,
`test(agent):` …) with a proper body — what & why, wrapped, with the `Co-Authored-By` trailer.
The sharp lesson came right after: rewording commits that had **already been merged** into
`master` (via earlier PRs) created duplicate-content commits and a merge conflict on a file my
refactor had moved. `git rebase origin/master` fixed it by dropping the already-merged
duplicates and replaying only the new commits. **Reword before the PR merges, not after** —
merged commits are permanent on `master`.

### Prompt 10
> Give me a full Week-5 implementation plan (MCP + multi-agent orchestration), and review it as a
> senior engineer before I build.

**What I was doing:** designing the next layer — expose the tools behind an **MCP server** and
(stretch) refactor into a **supervisor + workers** — and stress-testing the plan.

**What I learned:** two review passes caught traps that would have blocked the build, now
captured in the root [`week5.md`](../../../week5.md): **(1)** multi-agent × the 5 req/min Gemini
quota = instant 429, so the provider must be resolved *first*; **(2)** the JWT must ride in the
**MCP transport header, never as a tool argument** (or it leaks into the model context and
trace); **(3)** files must be exposed as MCP **tools**, not only *resources*, because a ReAct
loop only invokes tools; and **(4)** the trace/hook doesn't survive the MCP split without
propagating `runId` across the boundary and using a **synchronous** per-run store (Kafka is
async/unordered). Plan the failure modes before writing the happy path.

---

## Summary

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 1 | Provider bug | Gemini `thoughtSignature` must be captured and echoed back on functionCall parts |
| 2 | Error handling | Agents multiply rate limits; normalise SDK errors to a readable message + retry hint |
| 3 | Model management | Probe `generateContent`, don't trust the model list; use a `-latest` alias |
| 4 | UI redesign | Freeze the transport, swap only presentation; new Tailwind utilities need a fresh build |
| 5 | Onboarding | Teaching empty state + id-free starter prompts so the first click succeeds |
| 6 | Conventions | Align tests/events/filenames with siblings; git tracks moves as renames |
| 7 | Prompt authoring | Tools = code (`.js`); prompts = Markdown (`.md`) — sets up MCP prompts |
| 8 | Test isolation | Pin the provider so suites use the mock and never hit the live API |
| 9 | Git hygiene | Conventional Commits; reword *before* merge, rebase to drop merged duplicates |
| 10 | Week-5 planning | MCP + supervisor/worker; review the failure modes before building |

**Total prompts logged in this file: 10** (continues Week-4 Prompts 25–40 in the root log)

**Deliverable:** `agent-service` runs correctly on **Gemini** (`gemini-3.5-flash`) with the
function-calling `thoughtSignature` handled and SDK errors surfaced cleanly; its file layout now
matches the other backend services; the system prompt is authored in **Markdown**
(`systemPrompt.md`); and the test suite is **fully green offline** (12 suites, 66/66) with no
hidden network calls. Commits follow **Conventional Commits**, and the **Week-5 MCP +
orchestration plan** ([`week5.md`](../../../week5.md)) is reviewed and ready to build.
