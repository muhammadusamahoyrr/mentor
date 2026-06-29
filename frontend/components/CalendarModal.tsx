'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Clock, User, Calendar } from 'lucide-react';
import { Appointment } from '@/types';

interface CalendarModalProps {
  appointments: Appointment[];
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-emerald-500',
  pending:   'bg-amber-400',
  completed: 'bg-blue-500',
  cancelled: 'bg-rose-400',
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarModal({ appointments, onClose }: CalendarModalProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(
    today.toISOString().split('T')[0]
  );

  /* Build a map: "YYYY-MM-DD" → Appointment[] */
  const apptMap = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  /* Days grid for current view month */
  const { days, month, year } = useMemo(() => {
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();
    const firstDay = new Date(y, m, 1).getDay();      // 0=Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev  = new Date(y, m, 0).getDate();

    const cells: { date: string; dayNum: number; current: boolean }[] = [];

    // previous month's year/month for leading cells
    const prevMonthDate = new Date(y, m - 1, 1);
    const prevY = prevMonthDate.getFullYear();
    const prevM = prevMonthDate.getMonth() + 1;

    // next month's year/month for trailing cells
    const nextMonthDate = new Date(y, m + 1, 1);
    const nextY = nextMonthDate.getFullYear();
    const nextM = nextMonthDate.getMonth() + 1;

    // leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const date = `${prevY}-${String(prevM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ date, dayNum: d, current: false });
    }
    // current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ date, dayNum: d, current: true });
    }
    // trailing days to fill 6 rows (42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const date = `${nextY}-${String(nextM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ date, dayNum: d, current: false });
    }

    return { days: cells, month: m, year: y };
  }, [viewDate]);

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedAppts = selectedDate ? (apptMap[selectedDate] ?? []) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="relative w-full max-w-3xl bg-card rounded-3xl shadow-2xl border border-wire overflow-hidden z-10 tt"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-haze bg-panel/60 tt">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-muted rounded-xl border border-brand-border">
                <Calendar className="h-5 w-5 text-brand" />
              </div>
              <div>
                <h2 className="font-black text-ink text-lg tt">Schedule Calendar</h2>
                <p className="text-ghost text-xs font-medium tt">Click any date to view appointments</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-lift text-ghost hover:text-ink rounded-xl transition-colors tt"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Calendar grid — left panel */}
            <div className="flex-1 p-6">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={prevMonth}
                  className="p-2 hover:bg-panel text-ghost hover:text-ink rounded-xl transition-colors tt"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="font-black text-ink text-base tt">
                  {MONTH_NAMES[month]} {year}
                </h3>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-panel text-ghost hover:text-ink rounded-xl transition-colors tt"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Day name headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-ghost uppercase tracking-widest py-1 tt">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {days.map(({ date, dayNum, current }) => {
                  const appts = apptMap[date] ?? [];
                  const isToday    = date === todayStr;
                  const isSelected = date === selectedDate;
                  const hasAppts   = appts.length > 0 && current;

                  return (
                    <button
                      key={date}
                      onClick={() => current && setSelectedDate(date)}
                      disabled={!current}
                      className={`
                        relative flex flex-col items-center justify-start pt-1.5 pb-2 px-1 rounded-xl min-h-[52px]
                        transition-all duration-150 text-xs font-bold
                        ${!current ? 'opacity-20 cursor-default' : 'cursor-pointer hover:bg-panel tt'}
                        ${isSelected && current ? 'bg-brand text-white shadow-lg shadow-brand/30' : ''}
                        ${isToday && !isSelected ? 'ring-2 ring-brand ring-offset-1 ring-offset-transparent' : ''}
                        ${!isSelected && current ? 'text-ink tt' : ''}
                      `}
                    >
                      <span className={isSelected ? 'text-white' : ''}>{dayNum}</span>
                      {hasAppts && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {appts.slice(0, 3).map((a, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : STATUS_STYLES[a.status] ?? 'bg-ghost'}`}
                            />
                          ))}
                          {appts.length > 3 && (
                            <span className={`text-[8px] font-black ${isSelected ? 'text-white/80' : 'text-ghost'}`}>
                              +{appts.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-haze tt">
                {Object.entries(STATUS_STYLES).map(([status, cls]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
                    <span className="text-[10px] font-bold text-ghost capitalize tt">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day detail — right panel */}
            <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-haze bg-panel/40 p-5 tt">
              <div className="mb-4">
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest tt">
                  {selectedDate
                    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Select a date'}
                </p>
                <p className="text-xl font-black text-ink mt-0.5 tt">
                  {selectedAppts.length} appointment{selectedAppts.length !== 1 ? 's' : ''}
                </p>
              </div>

              {selectedAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 bg-panel rounded-2xl border border-wire mb-3 tt">
                    <Calendar className="h-7 w-7 text-ghost tt" />
                  </div>
                  <p className="text-ghost text-xs font-semibold tt">No appointments<br />on this day</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {selectedAppts.map(a => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-card rounded-xl border border-wire p-3 tt"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-ghost tt">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold">{a.time}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[a.status] ?? ''}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-ink tt">
                        <User className="h-3.5 w-3.5 text-ghost tt" />
                        <span className="text-xs font-bold truncate">{a.patient?.name ?? 'Patient'}</span>
                      </div>
                      {a.reason && (
                        <p className="text-ghost text-[10px] font-medium mt-1.5 leading-snug line-clamp-2 tt">
                          {a.reason}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
  );
}
