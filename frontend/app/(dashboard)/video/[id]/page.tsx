'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, PhoneOff, Maximize2, FileText, Video, Save, Check, Plus, Trash2 } from 'lucide-react';
import { Appointment } from '@/types';
import { getCurrentUser } from '@/lib/auth';

interface ClinicalNote {
  id?: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

// notes-service stores a title alongside the body; the editor is a single
// textarea, so the first line doubles as the note's title.
const deriveTitle = (content: string) =>
  content.trim().split('\n')[0].slice(0, 120);

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const [noteContent, setNoteContent] = useState('');
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savedNotes, setSavedNotes] = useState<ClinicalNote[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // The note the textarea is currently editing. null means "compose a new one".
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Load the appointment, then this session's notes. The current user is needed
  // before the notes land: the editor may only pick up a note *you* wrote, since
  // notes-service lets participants read each other's notes but not edit them.
  useEffect(() => {
    if (!id) return;
    let active = true;

    (async () => {
      const user = await getCurrentUser();
      if (!active) return;
      if (user) setCurrentUser({ id: user.id, role: user.role });

      try {
        const res = await fetch(`/api/appointments/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) setAppointment(data);
      } catch {
        if (active) setLoadError('Appointment not found or access denied.');
      }

      try {
        const res = await fetch(`/api/notes?appointmentId=${id}`);
        const notes: ClinicalNote[] = res.ok ? await res.json() : [];
        if (!active) return;

        setSavedNotes(notes);

        // Resume your own most recent note (the list is newest-first). Anyone
        // else's note stays read-only in the list below.
        const own = notes.find(n => n.authorId === user?.id);
        if (own?.id !== undefined) {
          setEditingNoteId(own.id);
          setNoteContent(own.content);
        }
      } catch {
        /* notes failing is non-fatal */
      }
    })();

    return () => { active = false; };
  }, [id]);

  // Cleanup save success flash timer
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const handleSaveNote = async () => {
    if (!noteContent.trim() || isSaving) return;
    setIsSaving(true);

    // Saving an already-saved note revises it. Only a note that has never been
    // saved creates a new record — otherwise every save appends a near-copy.
    const isRevision = editingNoteId !== null;

    try {
      const res = await fetch(
        isRevision ? `/api/notes/${editingNoteId}` : '/api/notes',
        {
          method: isRevision ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(isRevision ? {} : { appointmentId: id }),
            title: deriveTitle(noteContent),
            content: noteContent.trim(),
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const saved: ClinicalNote = await res.json();
      setSavedNotes(prev =>
        isRevision
          ? prev.map(n => (n.id === saved.id ? saved : n))
          : [saved, ...prev]
      );
      if (saved.id !== undefined) setEditingNoteId(saved.id);

      setSaveSuccess(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save note:', err);
      // Graceful degradation — note stays in textarea
    } finally {
      setIsSaving(false);
    }
  };

  // Park the current note and start a fresh one.
  const handleNewNote = () => {
    setEditingNoteId(null);
    setNoteContent('');
    setSaveSuccess(false);
  };

  // Completes CRUD from the UI. notes-service restricts DELETE to the doctor
  // role, so the button is only offered to doctors — the API enforces it anyway.
  const handleDeleteNote = async () => {
    if (editingNoteId === null || isDeleting) return;
    if (!confirm('Delete this clinical note? This cannot be undone.')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notes/${editingNoteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSavedNotes(prev => prev.filter(n => n.id !== editingNoteId));
      setEditingNoteId(null);
      setNoteContent('');
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete =
    editingNoteId !== null && currentUser?.role === 'doctor';

  const handleEndSession = () => {
    if (!confirm('Are you sure you want to end this session?')) return;
    router.back();
  };

  const patientName = appointment?.patient?.name ?? 'Patient';
  const doctorName  = appointment?.doctor?.name  ?? 'Doctor';

  // The editor holds one note; the list below shows all the others, including
  // notes written by the other participant (readable, but not editable here).
  const otherNotes = savedNotes.filter(n => n.id !== editingNoteId);

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.back()}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-all active:scale-95 text-slate-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
              Consultation Room
            </h1>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {loadError ? (
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{loadError}</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Dr. {doctorName} • Patient: {patientName}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleEndSession}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-200"
        >
          <PhoneOff className="h-4 w-4" />
          End Session
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex p-6 gap-6 min-h-0 overflow-hidden">
        {/* Video Placeholder */}
        <div className="flex-[3] flex flex-col min-h-0">
          <div className="flex-1 bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative border-8 border-white ring-1 ring-slate-200 flex items-center justify-center">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a,#1e293b)] opacity-90" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="p-6 bg-white/10 rounded-3xl backdrop-blur-sm border border-white/10">
                <Video className="h-16 w-16 text-white/60" />
              </div>
              <div>
                <p className="text-white font-black text-xl tracking-tight">Video Consultation</p>
                <p className="text-slate-400 text-sm mt-1 font-medium">
                  {doctorName} · {patientName}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Session Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — Clinical Notes */}
        <div className="flex-1 flex flex-col gap-4 min-w-[380px]">
          <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Clinical Notes</h2>
                  {savedNotes.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{savedNotes.length} saved note{savedNotes.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Persistent</span>
              </div>
            </div>

            {/* Note editor */}
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Record symptoms, diagnosis, or treatment plans here..."
              className="flex-1 p-8 text-slate-700 leading-relaxed resize-none outline-none font-medium placeholder:text-slate-300 bg-transparent text-sm custom-scrollbar"
            />

            {/* Footer: save button + status */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={handleSaveNote}
                disabled={!noteContent.trim() || isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
              >
                {isSaving ? (
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveSuccess ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saveSuccess ? 'Saved!' : isSaving ? 'Saving…' : editingNoteId !== null ? 'Update Note' : 'Save Note'}
              </button>

              {editingNoteId !== null && (
                <button
                  onClick={handleNewNote}
                  disabled={isSaving || isDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleDeleteNote}
                  disabled={isSaving || isDeleting}
                  title="Only a doctor may delete a clinical note"
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 disabled:opacity-40 border border-rose-200 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              )}

              <p className="text-[10px] font-bold text-slate-400 leading-tight">
                {editingNoteId !== null
                  ? 'Revising your saved note'
                  : 'Will be saved to the appointment record'}
              </p>
            </div>
          </div>

          {/* Previous notes — everything except whatever the editor currently holds */}
          {otherNotes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow p-4 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Earlier Notes</p>
              <div className="space-y-2">
                {otherNotes.map((note, i) => (
                  <div key={note.id ?? i} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-600 font-medium line-clamp-2">{note.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(note.createdAt).toLocaleTimeString()} · {note.authorName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleEndSession}
            className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl flex items-center justify-between group hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
                <PhoneOff className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Finalize Consultation</p>
                <p className="text-sm font-bold">End Session</p>
              </div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg group-hover:translate-x-1 transition-transform">
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </div>
          </button>
        </div>
      </main>

      <footer className="px-8 py-3 flex items-center justify-center gap-12 text-slate-400 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Secure Consultation</span>
        </div>
        <div className="flex items-center gap-2">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">High Definition Video</span>
        </div>
      </footer>
    </div>
  );
}
