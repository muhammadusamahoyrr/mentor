'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, PhoneOff, Maximize2, FileText, Video } from 'lucide-react';
import { MOCK_APPOINTMENTS_DOCTOR, MOCK_APPOINTMENTS_PATIENT } from '@/lib/mockData';

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const [noteContent, setNoteContent] = useState('');

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const allAppointments = [...MOCK_APPOINTMENTS_DOCTOR, ...MOCK_APPOINTMENTS_PATIENT];
  const seen = new Set<string>();
  const uniqueAppointments = allAppointments.filter(a => seen.has(a.id) ? false : seen.add(a.id) && true);
  const appointment = uniqueAppointments.find(a => a.id === id) || MOCK_APPOINTMENTS_DOCTOR[0];

  const handleEndSession = () => {
    if (!confirm('Are you sure you want to end this session?')) return;
    router.back();
  };

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
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Dr. {appointment.doctor?.name} • Patient: {appointment.patient?.name}
              </span>
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
                  {appointment.doctor?.name} · {appointment.patient?.name}
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
        <div className="flex-1 flex flex-col gap-6 min-w-[380px]">
          <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">Clinical Notes</h2>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Local</span>
              </div>
            </div>

            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Record symptoms, diagnosis, or treatment plans here..."
              className="flex-1 p-8 text-slate-700 leading-relaxed resize-none outline-none font-medium placeholder:text-slate-300 bg-transparent text-sm custom-scrollbar"
            />

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <Maximize2 className="h-4 w-4 text-blue-400" />
                <p className="text-[10px] font-bold text-blue-600 leading-tight">
                  Notes are saved locally for this session.
                </p>
              </div>
            </div>
          </div>

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
