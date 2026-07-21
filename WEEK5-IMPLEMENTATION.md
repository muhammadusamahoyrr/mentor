# Week 5 — What was built, and how to use it

Companion to [`week5.md`](week5.md). That file is the **proposal** (the plan);
this one is the **implementation** (what actually exists, and how to run it).

**Status:** CORE + STRETCH complete. 197 tests pass across both services, lint
clean, frontend typechecks. Shipped in commit `59e3d8f` on
`feat/backend-dev-runner`.

**✅ Verified live** (2026-07-21) against real Gemini + real Brave: a question
went agent-service → MCP → Brave → grounded answer with a parsed source, and the
trace stitched across BOTH processes via Redis. See §8 for what that run
uncovered.

---

## 1. The one-line summary

The agent's tools moved out of `agent-service` into a standalone **MCP server**
(`healthcare-mcp`), the agent became an **MCP client**, and on top of that sit a
validated answer trailer, a cross-process trace, provider fallback, and an
opt-in **supervisor + workers** orchestration layer.

```
Doctor UI (AgentPanel)
   │  POST /api/agent/ask   (SSE: session/token/tool/step/done/error)
   ▼
agent-service :3007 ──────────────────────────────────────────────┐
   │  AGENT_MODE=single      → one ReAct loop, all tools           │
   │  AGENT_MODE=supervisor  → route → workers (parallel) → compose│
   │                                                               │
   │  provider chain: anthropic | gemini | openrouter (fallback)   │
   │                                                               │
   │  tools via gateway:                                           │
   │    HEALTHCARE_MCP_URL set → MCP    ─────────────┐             │
   │    unset                  → in-process registry │             │
   └─────────────────────────────────────────────────┼─────────────┘
                                                     │ Streamable HTTP
                                                     │ headers: x-internal-token,
                                                     │ Authorization: Bearer <doctor JWT>,
                                                     │ x-run-id  (+ _meta.runId per call)
                                                     ▼
                                     healthcare-mcp :3008
                                       tools     × 5   ← the agent uses these
                                       resource  × 1   ← demo only
                                       prompts   × 2   ← demo only
                                                     │ forwards the doctor's JWT
                                                     ▼
                              file · appointment · Brave · Chroma

both sides write steps → shared trace store (Redis) keyed by runId
                       → GET /api/agent/traces/:runId
```

---

## 2. Features

### 2.1 `healthcare-mcp` — the MCP server (port 3008)

| Kind | Name | Notes |
|---|---|---|
| tool | `web_search` | Brave. The only tool that needs no backend service. |
| tool | `retrieve_docs` | Chroma semantic search, scoped by patientId **and** doctorId |
| tool | `list_patient_files` | file-service |
| tool | `read_patient_file` | file-service, PDF/text extraction |
| tool | `get_appointment` | appointment-service |
| resource | `patient-file://{fileId}` | browsable + readable; **demo only** |
| prompt | `summarise-and-cite`, `soap-note` | **demo only** |

- **Transports:** Streamable HTTP (`POST /mcp`) for service-to-service; **stdio**
  (`src/stdio.js`) for Claude Code / Cursor.
- **`read_file` is deliberately NOT exposed.** It reads the host filesystem, so
  it stays in agent-service's in-process registry only.
- Tools are **tools**, not just resources, because a ReAct loop only ever emits
  tool calls — it will never read an MCP resource on its own.

### 2.2 agent-service as MCP client

`src/agent/tools/gateway.js` picks the backend:

- `HEALTHCARE_MCP_URL` set → **MCP** (the Week-5 path)
- unset → **in-process registry** (CLI, tests, offline demo)

If MCP is configured but unreachable it **fails rather than silently falling
back** — a question quietly running against a different tool set, skipping the
MCP audit trail, is worse than a visible error.

### 2.3 Structured output guardrail

The model appends one machine-readable line; prose still streams token-by-token.

```
AGENT_META: {"sources":[{"title":"NICE NG136","ref":"https://..."}],"confidence":"high"}
```

Validated with Zod. On a malformed trailer: **one repair retry** asking only for
that line, then falls back to the legacy `CONFIDENCE:` marker. The trailer is
stripped from the stream by `markerFilter` so it never reaches the screen.

### 2.4 Trace / replay

- Every run gets a `runId`, propagated across MCP via **`_meta.runId`** (per-call,
  survives connection reuse) with the `x-run-id` header as fallback.
- Both services write steps to `Backend/shared/trace/traceStore.js`; steps carry
  `service`, `agent`, inputs, output summaries and timings.
- `GET /api/agent/traces/:runId`, scoped to the doctor who asked.
- UI: **View trace** (expand any step for input/output) + **Re-run**.
- Kafka remains the *durable audit*; the trace store backs the *live view*,
  because Kafka is async and unordered across partitions.

### 2.5 Provider fallback

Chain over `anthropic | gemini | openrouter`. A failed request rolls to the next.

- **Rolls over on:** 429, 5xx, network failure, 401/403 (misconfigured provider)
- **Does NOT roll over on:** 4xx we caused — every provider rejects it identically
- **Never mid-stream once tokens are on screen** — switching would print a second
  answer over the first
- Each provider gets **its own model name** substituted per attempt

### 2.6 Supervisor + workers (opt-in)

`AGENT_MODE=supervisor`. Route → delegate (parallel) → compose.

| Worker | Tools |
|---|---|
| `records` | `list_patient_files`, `read_patient_file`, `retrieve_docs` |
| `research` | `web_search` |
| `scheduling` | `get_appointment` |

- Each worker is a small ReAct agent with a **narrow tool slice** — a research
  worker calling `read_patient_file` gets refused.
- **Parallel** via `Promise.all`, **per-worker timeout**, **degrade don't crash**
  (a failed worker becomes thin evidence, lowering confidence).
- **`injectionGuard` re-applied at aggregation** — a worker that read a poisoned
  document must not pass an instruction up the graph.
- **Supervisor owns memory; workers are stateless** (`history: []`).
- Only the supervisor's composition streams as `token`; workers emit `step` only.
- Routing failure → degrades to single-agent rather than erroring.

---

## 3. Running it

### 3.1 Config you must add yourself

`.env` files are gitignored — only `.env.example` is committed.

**`Backend/services/agent-service/.env`**
```bash
HEALTHCARE_MCP_URL=http://localhost:3008/mcp
INTERNAL_SERVICE_TOKEN=<same value as healthcare-mcp>
# optional
OPENROUTER_API_KEY=<gives automatic fallback>
AGENT_MODE=single            # or: supervisor
AGENT_ORCHESTRATION=parallel # or: sequential (free-tier friendly)
AGENT_TRAILER_REPAIR=1       # 0 = skip the repair call
```

**`Backend/services/healthcare-mcp/.env`** — copy its `.env.example`; needs
`INTERNAL_SERVICE_TOKEN` (identical), `JWT_SECRET` (identical to auth-service),
plus the service URLs and API keys.

Generate a shared secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3.2 Commands

```bash
cd Backend && node dev.js          # all services incl. mcp:3008
cd Backend && node dev.js agent mcp # just these two

cd Backend/services/agent-service
npm test                            # 163 tests
npm run ask -- "your question"      # CLI (always in-process, no JWT needed)
npm run bench -- "your question"    # serial vs parallel vs single-agent
npm run eval:routing                # routing accuracy (add --delay=4000 on free tier)

cd Backend/services/healthcare-mcp
npm test                            # 34 tests
npm start                           # HTTP on :3008
npm run stdio                       # stdio, needs MCP_DOCTOR_JWT
```

**Redis matters:** without it, each process keeps a separate in-memory trace, so
a trace shows only one side. The response reports `backedByRedis` honestly.

### 3.3 Using it from Claude Code / Cursor

`stdio.js` runs standalone — it needs only `MCP_DOCTOR_JWT` (it *decodes*, it
does not verify). But its tools still reach into the backend: only `web_search`
works with the stack down.

```json
{
  "mcpServers": {
    "healthcare": {
      "command": "node",
      "args": ["<abs path>/Backend/services/healthcare-mcp/src/stdio.js"],
      "env": {
        "MCP_DOCTOR_JWT": "<doctor JWT>",
        "FILE_SERVICE_URL": "http://localhost:3005",
        "APPOINTMENT_SERVICE_URL": "http://localhost:3002",
        "BRAVE_API_KEY": "<key>"
      }
    }
  }
}
```

⚠️ **Never expose this server publicly.** It is a direct path to patient records
with a static shared secret and no rate limiting.

---

## 4. Where things live

```
Backend/shared/agent/            # ONE copy of the tool handlers
  tools/{webSearch,getAppointment,listPatientFiles,readPatientFile,
         retrieveDocs,serviceClient,registry}.js
  security/injectionGuard.js  utils/pdfText.js  vector/{embed,chunk,chroma}.js
Backend/shared/trace/traceStore.js   # Redis + in-proc fallback, per runId

Backend/services/healthcare-mcp/src/
  server.js      # express, POST /mcp
  stdio.js       # Claude Code / Cursor variant
  mcpServer.js   # buildServer(ctx): tools + resource + prompts + trace hook
  auth.js        # x-internal-token + doctor JWT, off the TRANSPORT
  schema.js      # JSON Schema -> Zod at the SDK boundary

Backend/services/agent-service/src/agent/
  loop.js                  # ReAct loop; takes an injectable tool gateway
  tools/gateway.js         # MCP vs in-process, plus slice() for workers
  tools/registry.js        # shared 5 + local read_file
  mcp/client.js            # MCP client, per-run connection
  answerSchema.js          # Zod AGENT_META trailer
  orchestration/{supervisor,workers,benchmark,routingEval}.js
  providers/{factory,fallback,usage,gemini,translate,
             openrouter,openrouterTranslate}.js
  events/traceSink.js
```

---

## 5. Decisions a future session should not re-litigate

1. **Real move, no shims.** The shared extraction deleted the originals and
   updated importers. Duplicate-looking forwarder files were what triggered the
   mentor's "files not replaced correctly" concern in the first place. Git
   recorded 10 of these as 100% renames.
2. **Delegation is an explicit flow, not agent-as-tool through `loop.js`.** The
   loop executes a turn's tool calls sequentially, so routing workers through it
   would forfeit parallelism and leave nowhere clean for a per-worker timeout.
3. **Orchestration is opt-in.** It costs several times more calls and, per
   `week5.md`, does not automatically improve answers — it fragments context.
4. **Tokens are reported as a floor, never as exact.** Providers differ and some
   withhold usage; `complete: false` means calls went uncounted.
5. **Routing accuracy is reported, not asserted.** It is the model's property;
   a pass/fail gate would break CI whenever a provider shifts behaviour.
6. **`read_file` stays off the network.** Host filesystem access.
7. **JSON Schema is the source of truth** for tool definitions (shared with the
   Anthropic/Gemini tool format); `schema.js` translates to Zod at the MCP edge.

## 6. Gotchas discovered the hard way

- **`dotenv.config()` reads the CWD's `.env`.** Requiring healthcare-mcp inside
  agent-service's Jest run re-injected real API keys that `jest.setup.js` had
  deleted — a test was about to hit the live Brave API. Tests strip them again.
- **The MCP client transport uses `global.fetch`.** Stubbing it to fake a
  sibling service breaks the protocol itself; stubs must pass local traffic
  through.
- **The SDK returns schema-validation and unknown-tool failures as `isError`
  results, not throws.** Assert the result, not a rejection.
- **`jest.mock` factories may only close over `mock`-prefixed variables.**
- **Repo paths are `Backend/` (capital B).** `git add backend/...` silently
  no-ops on Windows.
- **Windows has no `python3`**; use Node or the edit tools for scripted rewrites.

## 7. Not done

- `.mcp.json` is **not** committed — the Claude Code demo needs manual config.
  (Assignment item 2 is satisfied by the custom client, so this is optional.)
- `stdio.js` has no automated test (manually verified to boot).
- Frontend `TraceView`/`SourceList` are typechecked only — the repo has no
  frontend test setup. **The UI has not been opened in a browser yet** — the live
  run was driven over HTTP.
- Orchestration (`AGENT_MODE=supervisor`) has not been exercised live, only in
  tests. Expect it to be rate-limit sensitive on the Gemini free tier.

## 8. What the first live run (2026-07-21) uncovered

Run: real Gemini 2.5 flash + real Brave, agent-service ↔ healthcare-mcp.
Result: a correct, grounded answer on NICE NG136 in ~14.5s, `confidence: high`,
one parsed source, 3 `web_search` calls through MCP, trace spanning both
services. Three things had to be fixed to get there.

**1. `AGENT_MAX_STEPS=6` is too low for a research question.** The first attempt
returned *"(Stopped: reached the maximum number of reasoning steps)"* after six
`web_search` calls. The trace showed those queries progressively refining
(AHA/ACC → NICE → NG136 → PREVENT) — the model was researching properly and ran
out of budget, not looping. Raised the default to **10**. Tune down if the free
tier rate-limits.

**2. Local Redis is 3.0.504 — too old for the client.** The Windows Redis port
still shipping on this machine predates `HELLO` (Redis 6.0), which `redis@6.x`
sends for its RESP3 handshake. Every connect failed with
`ERR unknown command 'HELLO'` and BOTH session memory and the trace store
silently fell back to per-process memory — so the cross-process trace, a
headline feature, quietly did not work. Fixed by pinning **`RESP: 2`** in
`shared/trace/traceStore.js` and `agent-service/src/memory/session.js`. RESP2 is
understood by every Redis version and we use no RESP3 feature.

**3. Creating `.env` files broke the test suites — and made tests call live
APIs.** `dotenv.config()` fills any key that is ABSENT, and it runs *after*
`jest.setup.js`. So `delete process.env.BRAVE_API_KEY` handed the real key
straight back: `web_search` started succeeding and the fail-closed tests broke.
Same mechanism leaked the new `HEALTHCARE_MCP_URL` into every suite, pointing
them at an MCP server that was not running (500s everywhere).

> **Rule: in `jest.setup.js`, neutralise env with `= ''`, never `delete`.**
> An empty string is still "in" `process.env`, so dotenv leaves it alone, and
> every guard in the code treats it as missing.
