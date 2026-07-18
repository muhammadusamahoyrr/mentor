'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Search,
  FileText,
  FolderOpen,
  Calendar,
  Wrench,
  Loader2,
} from 'lucide-react';

// The panel streams from POST /api/agent/ask (SSE). Events: session, token,
// tool (phase start/end), done, error. The live tool row IS the hook log, made
// visible: each skill call the agent makes shows up as it happens.

type FinishedTool = { tool: string; ms?: number; ok?: boolean };
type LiveTool = { tool: string; running: boolean; ms?: number; ok?: boolean };
type Confidence = 'high' | 'medium' | 'low';
type Message = {
  role: 'user' | 'assistant';
  content: string;
  tools?: FinishedTool[];
  confidence?: Confidence;
};

const LANGUAGES = ['English', 'Spanish', 'Urdu', 'French', 'Arabic', 'Hindi'];

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

export default function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [liveTools, setLiveTools] = useState<LiveTool[]>([]);
  const [language, setLanguage] = useState('English');
  const sessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, liveTools]);

  const appendToLast = (text: string) =>
    setMessages((m) => {
      if (!m.length) return m;
      const last = m[m.length - 1];
      if (last.role !== 'assistant') return m;
      return [...m.slice(0, -1), { ...last, content: last.content + text }];
    });

  async function send() {
    const question = input.trim();
    if (!question || busy) return;

    setInput('');
    setMessages((m) => [...m, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setBusy(true);
    setLiveTools([]);

    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ question, sessionId: sessionRef.current, language }),
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
            setMessages((m) => {
              if (!m.length) return m;
              const last = m[m.length - 1];
              return [
                ...m.slice(0, -1),
                {
                  ...last,
                  content: answer || last.content,
                  confidence,
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
      appendToLast(`\n\n⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setLiveTools([]);
    }
  }

  return (
    <>
      {/* Launcher */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3.5 text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700"
        aria-label="Open the clinical research assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-bold">Ask AI</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-black/5 bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-indigo-600 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <div>
                  <p className="text-sm font-black leading-tight">Clinical Research Assistant</p>
                  <p className="text-[11px] text-indigo-100">Searches, reads & cites — never diagnoses</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {messages.length === 0 && (
                <div className="mt-10 text-center text-sm text-ghost">
                  <p className="font-semibold text-ink">Ask a clinical research question.</p>
                  <p className="mt-1">
                    e.g. “Summarise the report my patient shared and find current guidance.”
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white'
                        : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2.5 text-sm text-ink'
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {m.content || (busy && i === messages.length - 1 ? '…' : '')}
                    </p>
                    {m.role === 'assistant' && m.confidence && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            m.confidence === 'low'
                              ? 'bg-amber-100 text-amber-700'
                              : m.confidence === 'medium'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {m.confidence === 'low'
                            ? 'Low confidence — verify with doctor'
                            : `${m.confidence[0].toUpperCase()}${m.confidence.slice(1)} confidence`}
                        </span>
                      </div>
                    )}
                    {m.tools && m.tools.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
                        {m.tools.map((t, j) => {
                          const Icon = toolIcon(t.tool);
                          return (
                            <span
                              key={j}
                              className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-ghost"
                            >
                              <Icon className="h-3 w-3" />
                              {prettyTool(t.tool)}
                              {typeof t.ms === 'number' && <span className="opacity-60">· {t.ms}ms</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Live tool timeline (the hook log, in real time) */}
              {liveTools.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {liveTools.map((t, i) => {
                    const Icon = toolIcon(t.tool);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 self-start rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-ghost"
                      >
                        {t.running ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Icon className={`h-3 w-3 ${t.ok === false ? 'text-red-500' : 'text-emerald-500'}`} />
                        )}
                        {prettyTool(t.tool)}
                        {t.running ? <span className="opacity-60">running…</span> : <span className="opacity-60">· {t.ms}ms</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-black/5 bg-card px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
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
                  className="max-h-28 flex-1 resize-none rounded-2xl bg-surface px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ghost disabled:opacity-60"
                />
                <button
                  onClick={send}
                  disabled={busy || !input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
