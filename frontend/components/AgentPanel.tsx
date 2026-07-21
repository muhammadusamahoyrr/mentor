'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Square,
  Plus,
  Search,
  FileText,
  FolderOpen,
  Calendar,
  Wrench,
  Loader2,
  Check,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Link2,
  Activity,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

// The panel streams from POST /api/agent/ask (SSE). Events: session, token,
// tool (phase start/end), done, error. The live tool row IS the hook log, made
// visible: each skill call the agent makes shows up as it happens.
//
// `done` also carries the validated answer trailer (`sources`) and the `runId`,
// which addresses the full recorded trace at GET /api/agent/traces/:runId — the
// steps this service planned PLUS the ones the MCP server actually executed.

type FinishedTool = { tool: string; ms?: number; ok?: boolean };
type LiveTool = { tool: string; running: boolean; ms?: number; ok?: boolean };
type Confidence = 'high' | 'medium' | 'low';
type Source = { title: string; ref: string };
type TraceStep = {
  ts?: string;
  service?: string;
  type?: string;
  phase?: string;
  tool?: string;
  ok?: boolean;
  ms?: number;
  error?: string;
  question?: string;
  confidence?: string;
  steps?: number;
  stopReason?: string;
  args?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  injectionFlagged?: boolean;
};
type Message = {
  role: 'user' | 'assistant';
  content: string;
  tools?: FinishedTool[];
  confidence?: Confidence;
  sources?: Source[];
  runId?: string;
};
type Dock = 'side' | 'wide';

const LANGUAGES = ['English', 'Spanish', 'Urdu', 'French', 'Arabic', 'Hindi'];
const UI_KEY = 'careloop_agent_ui';

// Starter prompts shown on the empty screen so a first-time doctor can see —
// and one-click try — what the assistant actually does. Chosen to need no
// hand-typed ids: literature search, evidence summary, and listing shared files.
const SUGGESTIONS = [
  'What do current guidelines say about managing Stage 1 hypertension?',
  'Summarise recent evidence on lisinopril side effects, with sources.',
  'List the documents my patients have shared with me.',
  'Find recent literature on managing type 2 diabetes.',
];

const toolIcon = (name: string) => {
  if (name === 'web_search') return Search;
  if (name === 'read_file' || name === 'read_patient_file') return FileText;
  if (name === 'list_patient_files') return FolderOpen;
  if (name === 'get_appointment') return Calendar;
  return Wrench;
};

const prettyTool = (name: string) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function parseFrame(frame: string): { event?: string; data?: unknown } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  let data: unknown;
  if (dataLines.length) {
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = dataLines.join('\n');
    }
  }
  return { event, data };
}

// ── The tool timeline, as a connected vertical stepper. This is the "hook log"
// made legible: a rail with a node per skill — spinner while running, a green
// check when done, red cross on failure — with timings. ────────────────────────
function ToolStepper({ tools }: { tools: LiveTool[] }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-3">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold text-ghost">
        <Wrench className="h-3.5 w-3.5" />
        Working through the request
      </div>
      <div className="relative pl-1">
        <span className="absolute bottom-2 left-[11px] top-2 w-px bg-black/10" aria-hidden />
        {tools.map((t, i) => {
          const Icon = toolIcon(t.tool);
          const failed = t.ok === false;
          return (
            <div key={i} className="relative flex items-center gap-2.5 py-1">
              <span
                className={`z-10 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${
                  t.running
                    ? 'border-indigo-500 bg-card text-indigo-600'
                    : failed
                      ? 'border-red-400 bg-red-50 text-red-500'
                      : 'border-emerald-500 bg-emerald-50 text-emerald-600'
                }`}
              >
                {t.running ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : failed ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>
              <Icon className="h-3.5 w-3.5 shrink-0 text-ghost" />
              <span className="truncate text-[12.5px] font-semibold text-ink">{prettyTool(t.tool)}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ghost">
                {t.running ? (
                  <span className="text-indigo-600">running…</span>
                ) : (
                  `${t.ms ?? 0}ms`
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The validated `sources` from the answer trailer. These are what the agent says
// it actually used — a URL for web results, a filename/id for a patient document.
function SourceList({ sources }: { sources: Source[] }) {
  const isUrl = (ref: string) => /^https?:\/\//i.test(ref);
  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-ghost">
        <Link2 className="h-3.5 w-3.5" />
        Sources
      </div>
      <ul className="space-y-1.5">
        {sources.map((s, i) => (
          <li key={i} className="text-[12.5px] leading-snug">
            {isUrl(s.ref) ? (
              <a
                href={s.ref}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
              >
                {s.title}
              </a>
            ) : (
              <span className="font-semibold text-ink">{s.title}</span>
            )}
            <span className="ml-1.5 break-all text-[11px] text-ghost">{s.ref}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One step in the trace. A step that carries inputs or an output summary can be
// expanded — "what did that tool actually return?" is most of the reason to open
// a trace at all, so the data has to be reachable, not just the timing.
function TraceRow({ step, label, detail }: { step: TraceStep; label: string; detail: string }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!step.args || !!step.output;
  const failed = step.ok === false || step.phase === 'error';

  return (
    <li className="text-[12px] leading-snug">
      <div className="flex items-baseline gap-2">
        <span
          className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${failed ? 'bg-red-400' : 'bg-indigo-400'}`}
          aria-hidden
        />
        {hasDetail ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 font-semibold text-ink underline-offset-2 hover:underline"
            title={open ? 'Hide inputs / output' : 'Show inputs / output'}
          >
            {label}
          </button>
        ) : (
          <span className="shrink-0 font-semibold text-ink">{label}</span>
        )}
        <span className="min-w-0 flex-1 truncate text-ghost">{detail}</span>
        {step.injectionFlagged && (
          <span
            className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700"
            title="Prompt-injection signature found in this content — it was neutralized before the model saw it."
          >
            injection
          </span>
        )}
        {step.service && (
          <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[9.5px] font-semibold text-ghost">
            {step.service.replace('-service', '').replace('healthcare-', '')}
          </span>
        )}
      </div>

      {open && hasDetail && (
        <div className="ml-3.5 mt-1 space-y-1.5 border-l border-black/10 pl-2.5">
          {step.args && (
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-ghost">Input</p>
              <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-ink">
                {JSON.stringify(step.args, null, 2)}
              </pre>
            </div>
          )}
          {step.output && (
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-ghost">Output</p>
              <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-ink">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// The recorded trace for one run, fetched on demand. This is the debugging
// surface: it shows who did what, in order, across BOTH processes — the planning
// that happened in agent-service and the tool calls that ran inside the MCP
// server. Replay = reading this tree back, plus re-asking the same question
// (an LLM will not reproduce identical text, but the failure pattern reproduces).
function TraceView({ runId, onRerun }: { runId: string; onRerun?: () => void }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<TraceStep[] | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || steps || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/traces/${encodeURIComponent(runId)}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'This trace has expired.' : `Could not load trace (${res.status}).`);
        return;
      }
      const data = await res.json();
      setSteps(data.steps ?? []);
      setServices(data.services ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const label = (s: TraceStep) => {
    if (s.type === 'run' && s.phase === 'start') return 'Run started';
    if (s.type === 'run' && s.phase === 'end') return 'Run finished';
    if (s.type === 'run' && s.phase === 'error') return 'Run failed';
    return prettyTool(s.tool ?? 'step');
  };

  const detail = (s: TraceStep) => {
    if (s.type === 'run' && s.phase === 'start') return s.question ?? '';
    if (s.type === 'run' && s.phase === 'end')
      return `${s.confidence ?? '—'} confidence · ${s.steps ?? 0} step(s) · ${s.stopReason ?? ''}`;
    if (s.error) return s.error;
    // 'call' is the agent's own view of a tool it requested; 'start'/'end' are
    // the MCP server actually running it.
    if (s.phase === 'call') return `requested · ${s.ms ?? 0}ms round trip`;
    if (s.phase === 'start') return 'executing…';
    return `${s.ms ?? 0}ms`;
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-ghost transition hover:text-ink"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Activity className="h-3.5 w-3.5" />
          View trace
        </button>
        {onRerun && (
          <button
            onClick={onRerun}
            title="Ask the same question again"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-ghost transition hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Re-run
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-2xl border border-black/5 bg-surface p-3">
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-ghost">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trace…
            </div>
          )}
          {error && <p className="text-[12px] text-amber-700">{error}</p>}

          {steps && !loading && !error && (
            <>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ghost">
                {steps.length} step(s) · {services.join(' + ') || 'agent-service'}
              </p>
              <ol className="space-y-1">
                {steps.map((s, i) => (
                  <TraceRow key={i} step={s} label={label(s)} detail={detail(s)} />
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const style =
    level === 'low'
      ? 'bg-amber-100 text-amber-700'
      : level === 'medium'
        ? 'bg-slate-200 text-slate-600'
        : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${style}`}>
      <ShieldCheck className="h-3 w-3" />
      {level === 'low' ? 'Low confidence — verify with doctor' : `${level[0].toUpperCase()}${level.slice(1)} confidence`}
    </span>
  );
}

export default function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<Dock>('side');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveTools, setLiveTools] = useState<LiveTool[]>([]);
  const [language, setLanguage] = useState('English');
  const sessionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Restore dock + language preferences.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const o = JSON.parse(raw) as { dock?: Dock; language?: string };
        if (o.dock === 'side' || o.dock === 'wide') setDock(o.dock);
        if (o.language) setLanguage(o.language);
      }
    } catch {
      /* ignore malformed prefs */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ dock, language }));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [dock, language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, liveTools]);

  // Auto-grow the composer as the doctor types.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const appendToLast = (text: string) =>
    setMessages((m) => {
      if (!m.length) return m;
      const last = m[m.length - 1];
      if (last.role !== 'assistant') return m;
      return [...m.slice(0, -1), { ...last, content: last.content + text }];
    });

  function newChat() {
    if (busy) return;
    setMessages([]);
    setLiveTools([]);
    setInput('');
    sessionRef.current = null;
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function send(preset?: string) {
    // A suggestion chip passes its text here; the composer button/Enter pass no
    // string (an event object at most), so fall back to the input box.
    const question = (typeof preset === 'string' ? preset : input).trim();
    if (!question || busy) return;

    setInput('');
    setMessages((m) => [...m, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setBusy(true);
    setLiveTools([]);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ question, sessionId: sessionRef.current, language }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => '');
        appendToLast(`\n\n⚠️ ${res.status} — ${err || 'request failed'}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const { event, data } = parseFrame(frame);
          if (!event) continue;
          const d = data as Record<string, unknown>;

          if (event === 'session') {
            sessionRef.current = (d?.sessionId as string) ?? sessionRef.current;
          } else if (event === 'token') {
            appendToLast((d?.text as string) ?? '');
          } else if (event === 'tool') {
            const tool = d?.tool as string;
            if (d?.phase === 'start') {
              setLiveTools((t) => [...t, { tool, running: true }]);
            } else {
              setLiveTools((t) =>
                t.map((x) =>
                  x.tool === tool && x.running
                    ? { ...x, running: false, ms: d?.ms as number, ok: d?.ok as boolean }
                    : x
                )
              );
            }
          } else if (event === 'done') {
            const answer = (d?.answer as string) ?? '';
            const tools = (d?.tools as FinishedTool[]) ?? [];
            const confidence = d?.confidence as Confidence | undefined;
            const sources = (d?.sources as Source[]) ?? [];
            const runId = d?.runId as string | undefined;
            setMessages((m) => {
              if (!m.length) return m;
              const last = m[m.length - 1];
              return [
                ...m.slice(0, -1),
                {
                  ...last,
                  content: answer || last.content,
                  confidence,
                  sources,
                  runId,
                  tools: tools.map((tl) => ({ tool: tl.tool, ms: tl.ms, ok: tl.ok })),
                },
              ];
            });
          } else if (event === 'error') {
            appendToLast(`\n\n⚠️ ${(d?.error as string) ?? 'agent error'}`);
          }
        }
      }
    } catch (e) {
      // A manual Stop aborts the fetch — that's not an error to surface.
      if ((e as Error).name !== 'AbortError') {
        appendToLast(`\n\n⚠️ ${(e as Error).message}`);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setLiveTools([]);
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3.5 text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700"
          aria-label="Open the clinical research assistant"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-bold">Ask AI</span>
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            key="agent-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-black/5 bg-card shadow-2xl transition-[width] duration-300 sm:rounded-l-3xl ${
              dock === 'wide' ? 'sm:w-[680px]' : 'sm:w-[430px]'
            }`}
            aria-label="Clinical research assistant"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-[18px] w-[18px]" />
              </div>
              <div className="mr-auto min-w-0">
                <p className="truncate text-sm font-black leading-tight text-ink">Clinical Research Assistant</p>
                <p className="truncate text-[11px] text-ghost">Searches, reads &amp; cites — never diagnoses</p>
              </div>

              {messages.length > 0 && (
                <button
                  onClick={newChat}
                  disabled={busy}
                  title="New conversation"
                  aria-label="New conversation"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ghost transition hover:bg-surface hover:text-ink disabled:opacity-40"
                >
                  <Plus className="h-[18px] w-[18px]" />
                </button>
              )}
              <button
                onClick={() => setDock((d) => (d === 'wide' ? 'side' : 'wide'))}
                title={dock === 'wide' ? 'Collapse panel' : 'Expand panel'}
                aria-label={dock === 'wide' ? 'Collapse panel' : 'Expand panel'}
                className="hidden h-8 w-8 place-items-center rounded-lg text-ghost transition hover:bg-surface hover:text-ink sm:grid"
              >
                {dock === 'wide' ? <Minimize2 className="h-[17px] w-[17px]" /> : <Maximize2 className="h-[17px] w-[17px]" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-ghost transition hover:bg-surface hover:text-ink"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-5">
              {messages.length === 0 && (
                <div className="pt-2">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/30">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <p className="text-center text-[17px] font-black tracking-tight text-ink">
                    Your clinical research assistant
                  </p>
                  <p className="mx-auto mt-2 max-w-[34ch] text-center text-[13px] leading-relaxed text-ghost">
                    I search current medical literature and read the reports your patients share, then
                    summarise the evidence <span className="font-semibold text-ink">with sources</span>. I
                    don’t diagnose or prescribe — the decision stays yours.
                  </p>

                  <p className="mb-2.5 mt-6 text-[10px] font-bold uppercase tracking-wider text-ghost">
                    Try asking
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        disabled={busy}
                        className="group flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-3 py-3 text-left text-[13px] leading-snug text-ink transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-500/10 disabled:opacity-50"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-black/5 bg-card text-indigo-600">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const streaming = busy && isLast && m.role === 'assistant';

                if (m.role === 'user') {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white shadow-sm shadow-indigo-500/20">
                        {m.content}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5"
                  >
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Live tool timeline sits above the answer while it streams. */}
                      {streaming && liveTools.length > 0 && (
                        <div className="mb-2.5">
                          <ToolStepper tools={liveTools} />
                        </div>
                      )}

                      <div className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">
                        {m.content || (streaming && liveTools.length === 0 ? 'Thinking…' : '')}
                        {streaming && (
                          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-indigo-500" aria-hidden />
                        )}
                      </div>

                      {m.confidence && <ConfidenceBadge level={m.confidence} />}

                      {m.sources && m.sources.length > 0 && <SourceList sources={m.sources} />}

                      {m.runId && !streaming && (
                        <TraceView
                          runId={m.runId}
                          onRerun={() => {
                            // Replay: re-ask the same question. An LLM will not
                            // reproduce identical prose, but a failure pattern will.
                            const asked = messages[i - 1];
                            if (asked?.role === 'user') send(asked.content);
                          }}
                        />
                      )}

                      {m.tools && m.tools.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/5 pt-2.5">
                          {m.tools.map((t, j) => {
                            const Icon = toolIcon(t.tool);
                            return (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ghost"
                              >
                                <Icon className="h-3 w-3" />
                                {prettyTool(t.tool)}
                                {typeof t.ms === 'number' && <span className="tabular-nums opacity-60">· {t.ms}ms</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Composer */}
            <div className="border-t border-black/5 bg-card px-3 py-3">
              <div className="flex items-end gap-2 rounded-2xl border border-black/5 bg-surface px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/15">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask a research question…"
                  disabled={busy}
                  className="max-h-28 flex-1 resize-none bg-transparent py-1 text-[13.5px] text-ink outline-none placeholder:text-ghost disabled:opacity-60"
                />
                {busy ? (
                  <button
                    onClick={stop}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink ring-1 ring-black/10 transition hover:bg-lift"
                    aria-label="Stop generating"
                    title="Stop"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <label className="flex items-center gap-1 text-[10px] text-ghost">
                  Reply in
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={busy}
                    className="rounded-md bg-surface px-1 py-0.5 text-[10px] font-semibold text-ink outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-[10px] text-ghost">Research aid — not a diagnosis.</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
