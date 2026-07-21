# Week 5 — MCP, Multi-Agent Orchestration & Tool Design

**Project:** CareLoop clinical research agent
**Goal:** move the single ReAct agent into a system where tools live behind a **standalone MCP server** and (stretch) a **supervisor delegates to parallel workers** — with structured-output guardrails, a real trace/replay surface, and a measured cost/latency story.
**Deliverable:** working system + this proposal.

> This plan already folds in two design-review passes. Anything marked **⚠️** is a decision or trap that must be handled *before* the code around it, or it will break mid-build.

---

## 0. GATE — decide this first (blocks everything)

**⚠️ Multi-agent is incompatible with the current Gemini free tier.**
The free key allows ~**5 requests/minute**. A supervisor + workers makes **8–12 model calls per question**, so orchestration will `429` on the very first query.

**Decision (pick one before building workers):**
1. **Add a Claude key** — the code already supports Anthropic (`ANTHROPIC_API_KEY`), zero rate-limit drama. *Recommended.*
2. **Rate-limiter + sequential workers** — a shared queue in front of the provider, workers run one-at-a-time with backoff (kills the latency benefit; only if staying on free tier).

The **CORE** milestones (single agent over MCP) run fine on the current quota. The **STRETCH** (orchestration) requires this gate resolved.

---

## 1. Where we are today (baseline)

```
Doctor UI (AgentPanel) ──POST /api/agent/ask (SSE)──► agent-service
                                                          │
                                    loop.js (ReAct, max 6 steps)
                                    tools/registry.js  (6 IN-PROCESS tools)
                                       ├─ web_search      → Brave
                                       ├─ retrieve_docs   → ChromaDB
                                       └─ *_patient_file / get_appointment
                                    hook → Kafka → audit-service
                                                          │ (doctor JWT forwarded)
                              file-service / notes / appointment
```
Tools are functions *inside* agent-service; one agent does everything.

---

## 2. Where we're going (target)

```
Doctor UI (AgentPanel) ──SSE (runId)──► agent-service
   ┌── SUPERVISOR (stretch) ─ owns memory; delegates in PARALLEL ─┐
   │     ├─ Records worker    (stateless)                          │
   │     ├─ Research worker   (stateless)                          │   trace collected
   │     └─ Scheduling worker (stateless)                          │   synchronously
   └───────────────── each worker = small ReAct agent ────────────┘   per runId
                          │ MCP client (JWT in transport header)       │
                          ▼                                            ├─► trace store (Mongo/Redis)  → Trace view
              ┌──── healthcare-mcp SERVER ────┐                        └─► Kafka → audit-service (durable)
              │  TOOLS:     web_search,        │
              │             retrieve_docs,     │  ← agent uses TOOLS
              │             list/read_patient, │
              │             get_appointment    │
              │  RESOURCES: patient-file://id  │  ← Claude Code / Cursor demo only
              │  PROMPTS:   summarise, soap    │  ← demo only
              │  own hook (runId propagated)   │
              └────────────────────────────────┘
                          │ forwards doctor JWT
                          ▼
              file-service / notes / appointment / Brave / ChromaDB
```

Two shifts: **tools move out into an MCP server**, and (stretch) **one agent becomes a supervisor + parallel workers**.

---

## 3. CORE features (must ship — run on current quota)

### 3.1 Healthcare MCP server
New service `Backend/services/healthcare-mcp/` (Node, `@modelcontextprotocol/sdk`).

- **Tools** (the agent calls these): `web_search`, `retrieve_docs`, `get_appointment`, **`list_patient_files`, `read_patient_file`**.
  **⚠️ Files must be TOOLS, not only resources.** The ReAct loop (Claude `tool_use` / Gemini functionCall) only invokes *tools* — it will never read an MCP *resource* on its own.
- **Resources** (`patient-file://{fileId}`) and **Prompts** (`summarise-and-cite`, `soap-note`): **demo-facing only** — for showing the server inside Claude Code / Cursor. The runtime agent does not use them.
- **Transport:** **Streamable HTTP** for service-to-service; **stdio** variant for the Claude Code / Cursor demo.
- **Capability negotiation:** show the client asking the server what it supports (this *is* the "MCP capabilities" topic).

**⚠️ Auth model (the real design decision).** Tools need the *doctor's* JWT to call downstream services per-user.
- The JWT rides in the **transport `Authorization` header**, on a **per-request MCP session**.
- **Never** pass the JWT as a tool argument — tool args land in the LLM context and trace logs (credential leak).
- agent-service authenticates to the MCP server with the existing **`INTERNAL_SERVICE_TOKEN`** (service-to-service trust); the MCP server reads the forwarded doctor JWT into each handler's `ctx`.

**⚠️ Code sharing:** extract the tool handlers into `Backend/shared/` so agent-service and the MCP server use **one copy**, not duplicates.

### 3.2 agent-service as MCP client (single agent first)
- On startup, agent-service opens an MCP client (`agent/mcp/client.js`), **lists** the server's tools, and hands them to the LLM.
- `loop.js` barely changes — it calls tools **through MCP** instead of in-process, forwarding the JWT per request.
- **This is the minimum viable submission:** the single existing agent, working end-to-end over MCP. It proves the hardest parts (auth passthrough, transport, `runId` propagation) before any orchestration.

### 3.3 Structured output guardrail — a validated *trailer*, not full JSON
**⚠️ Full-JSON output breaks streaming** (you can't stream half-formed JSON; you'd lose the token/caret UX).
- Keep **prose streaming** for the answer.
- The model appends a small structured block at the end (`sources[]` + `confidence`), which you **parse and validate with Zod**, with **one repair retry** on failure.
- This formalizes the `CONFIDENCE:` marker you already have. Reuse the Zod pattern from `notes-service/noteSchema.js`.
- Full-JSON mode is reserved for the non-streaming path (future SOAP note).

```
AgentAnswer = { answer: string, sources: {title, ref}[], confidence: "high"|"medium"|"low" }
```

### 3.4 Trace surface (debugging)
**⚠️ Two bugs the naive design hides:**
1. **The hook moves.** Once tools run inside the MCP server, agent-service only sees "called X via MCP." The **MCP server needs its own hook**, and **`runId` must propagate across the MCP boundary** (via MCP call `_meta`) so the trace stitches back together.
2. **Kafka is the wrong source of truth for the live view** — it's async and not ordered across partitions, so "show this run now" gets late/out-of-order steps.

**Design:**
- Collect the trace **synchronously per `runId`** (in-memory during the run → persisted to Mongo/Redis) for the view.
- Keep **Kafka only for durable audit**.
- `GET /api/agent/traces/:runId` → full step tree; frontend renders who-called-what, inputs/outputs, timings.
- **Replay** = a deterministic **viewer** of the recorded step tree + the ability to **re-run the same inputs** to reproduce a *failure pattern* — **not** identical LLM text (LLMs are non-deterministic).

---

## 4. STRETCH features (only after the GATE + CORE)

### 4.1 Supervisor + workers
- **Supervisor** — routes the question, delegates, aggregates, owns the answer. Its "tools" are the **workers** (agent-as-tool hand-off).
- **Workers** (each a mini ReAct agent, narrow toolset + focused prompt):
  - Records → patient files + `retrieve_docs`
  - Research → `web_search`
  - Scheduling → `get_appointment`
- Each worker reuses `loop.js` with a smaller tool slice.

**⚠️ Honest framing:** orchestration may *not* improve answers here — splitting fragments context (the research worker can't see what records found unless the supervisor passes it). Keep it **minimal (supervisor + 2 workers)**; it's for the **learning objective** and future parallel work. **Measure quality/latency/cost before vs after** — that comparison is itself a graded "cost & latency" deliverable.

### 4.2 Streaming contract (don't regress the panel)
**⚠️** In multi-agent, define whose text streams:
- **Only the supervisor's final composition streams as `token` events.**
- Workers and tools emit **`step`/`tool` events only** (timeline, not chat). Add `agent: supervisor|records|research`, `phase: start|end` to the event.

### 4.3 Parallelism & failure semantics
- **⚠️ Run independent workers in PARALLEL** (`Promise.all`) — sequential delegation pays the full multi-agent cost with **no latency benefit**.
- **Per-worker timeout.**
- **Degrade, don't crash:** on worker failure/timeout/429, the supervisor returns a **partial answer with lower confidence** (ties into the confidence system).
- **Budget guard:** cap total steps across workers *and* max parallel fan-out (also protects the rate limit).

### 4.4 Security — cross-agent injection boundary
**⚠️** A worker reading an untrusted patient file can pass an injected instruction up to the supervisor. Treat **worker outputs as data, not instructions**, and **re-apply `injectionGuard` at the supervisor's aggregation step**, not just at tool input.

### 4.5 Memory ownership
**⚠️ Supervisor owns the Redis session memory; workers are stateless** — subtask in, result out, remember nothing. Otherwise intermediate junk corrupts the conversation history.

### 4.6 Cost & latency
- **Supervisor** = stronger model; **workers** = cheaper model (per-role in `providers/index.js`).
- Log **ms per step** (reliable) and **tokens** (approximate — Gemini reports usage only at stream end; don't over-claim).
- Report **serial-vs-parallel** latency/cost.

---

## 5. Testing / eval
- **MCP integration tests:** list tools, call one tool with a valid JWT, assert auth rejection without it.
- **Routing eval set:** 10–15 `question → expected worker` pairs → measure supervisor routing accuracy (report the number, don't assert it).
- **Injection red-team:** reuse the existing suite against the MCP boundary *and* the supervisor aggregation step.
- **Trace test:** one run produces a complete, correctly-nested step tree under its `runId`.

---

## 6. Sequencing (half-week)

```
GATE   0. Provider/quota decision (Claude key OR limiter+sequential)

CORE   1. healthcare-mcp server: tools (+resources/prompts for demo), JWT in transport header, shared handlers
       2. agent-service = MCP client with the EXISTING single agent  → proves auth + runId propagation
       3. structured trailer (Zod) + prose streaming
       4. trace: sync per-runId store for the view, Kafka for durable audit

STRETCH 5. supervisor + 2 workers, PARALLEL, per-worker timeout, degrade-on-failure
        6. re-guard injection at aggregation; supervisor owns memory, workers stateless
        7. serial-vs-parallel measurement; routing eval set
```
**If time is tight, ship CORE (1–4).** That fully satisfies "cover MCP end-to-end" and is a strong submission on its own.

---

## 7. Key decisions (state these in the proposal)
1. **Provider/quota** resolved before orchestration (the GATE).
2. **JWT in the MCP transport header**, never in tool arguments; service-to-service trust via `INTERNAL_SERVICE_TOKEN`.
3. **Files exposed as tools** for the agent (+ resources/prompts for the Claude Code demo only).
4. **Structured trailer + Zod**, not full-JSON output (preserves streaming).
5. **Trace = sync per-runId store** for the view; **Kafka = durable audit**; `runId` propagated across MCP.
6. **Orchestration = agent-as-tool, parallel, degrade-on-failure**, framed as a learning/measurement exercise — not an assumed quality win.
7. **Shared tool handlers** in `Backend/shared/`; new service wired into `feat/backend-dev-runner`.

## 8. Top risks
- **Rate limit** (GATE) — the #1 blocker; multi-agent multiplies it.
- **Auth passthrough through MCP** — prototype first; the trickiest CORE piece.
- **Trace correctness across the MCP split** — needs `runId` propagation + a sync store.
- **Context fragmentation** in multi-agent — keep worker scopes narrow (the "tool design" topic in practice).
- **Dev-run friction** — one more process on an already large stack; lean on the dev runner + shared code.
