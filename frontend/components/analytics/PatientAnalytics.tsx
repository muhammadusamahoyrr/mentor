'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Heart, Activity, Scale, TrendingDown, Plus } from 'lucide-react';
import { Appointment } from '@/types';
import { getMyVitals, recordVital, type VitalReading, type NewVitalReading } from '@/lib/auth';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const VITAL_UNITS: Record<string, string> = {
  heartRate: ' bpm',
  systolic:  ' mmHg',
  diastolic: ' mmHg',
  weightKg:  ' kg',
};

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-wire rounded-xl px-4 py-3 shadow-xl text-xs tt">
      <p className="font-black text-ink mb-2 tt">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-dim tt">{p.name}:</span>
          <span className="font-bold text-ink ml-1 tt">
            {p.value}{VITAL_UNITS[p.dataKey] ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
};

type VitalKey = 'heartRate' | 'systolic' | 'weightKg';

const VITAL_CONFIG: Record<VitalKey, { label: string; unit: string; color: string; icon: React.ElementType; refLow: number; refHigh: number; gradient: string }> = {
  heartRate: { label: 'Heart Rate',     unit: 'bpm',  color: '#ef4444', icon: Heart,    refLow: 60,  refHigh: 100, gradient: 'gradHR'  },
  systolic:  { label: 'Blood Pressure', unit: 'mmHg', color: '#3b82f6', icon: Activity, refLow: 90,  refHigh: 120, gradient: 'gradBP'  },
  weightKg:  { label: 'Body Weight',    unit: 'kg',   color: '#10b981', icon: Scale,    refLow: 60,  refHigh: 90,  gradient: 'gradWgt' },
};

interface PatientAnalyticsProps {
  appointments?: Appointment[];
}

/** Records one reading. Every field is optional; at least one must be filled. */
function RecordVitalForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ heartRate: '', systolic: '', diastolic: '', weightKg: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Only send the fields the patient actually filled in — an empty box is
    // "not measured", not zero.
    const reading: NewVitalReading = {};
    if (form.heartRate) reading.heartRate = Number(form.heartRate);
    if (form.systolic) reading.systolic = Number(form.systolic);
    if (form.diastolic) reading.diastolic = Number(form.diastolic);
    if (form.weightKg) reading.weightKg = Number(form.weightKg);

    if (Object.keys(reading).length === 0) {
      setError('Enter at least one measurement.');
      return;
    }
    if ((reading.systolic === undefined) !== (reading.diastolic === undefined)) {
      setError('Blood pressure needs both the upper and lower number.');
      return;
    }

    setSaving(true);
    try {
      await recordVital(reading);
      onSaved();
    } catch (err) {
      // Surface the server's own validation message rather than a generic one.
      setError(err instanceof Error ? err.message : 'Could not save the reading.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, k: keyof typeof form, placeholder: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-black text-ghost uppercase tracking-widest tt">{label}</span>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={form[k]}
        onChange={set(k)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl bg-panel border border-wire text-ink text-sm font-bold outline-none focus:border-brand tt"
      />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-2xl bg-panel border border-wire tt">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {field('Heart rate', 'heartRate', 'bpm')}
        {field('Systolic', 'systolic', 'mmHg')}
        {field('Diastolic', 'diastolic', 'mmHg')}
        {field('Weight', 'weightKg', 'kg')}
      </div>

      {error && <p className="text-xs font-semibold text-danger mt-3 tt">{error}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-brand text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95"
        >
          {saving ? 'Saving…' : 'Save reading'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-card border border-wire text-dim text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PatientAnalytics({ appointments = [] }: PatientAnalyticsProps) {
  const [activeVital, setActiveVital] = useState<VitalKey>('heartRate');
  const config = VITAL_CONFIG[activeVital];
  const Icon = config.icon;

  // ── Vitals: the patient's own readings from notes-service ────
  // These used to be a hardcoded array in mockData.ts. Nothing in the system
  // recorded vitals at all, so the chart was showing invented numbers to a
  // patient as if they were their own health data.
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [vitalsError, setVitalsError] = useState('');
  const [showRecord, setShowRecord] = useState(false);

  const loadVitals = useCallback(async () => {
    try {
      setVitals(await getMyVitals());
      setVitalsError('');
    } catch {
      setVitalsError('Could not load your readings.');
    } finally {
      setVitalsLoading(false);
    }
  }, []);

  useEffect(() => { loadVitals(); }, [loadVitals]);

  // Shape the readings for Recharts, keeping only the points that actually have
  // a value for the metric on screen — a weight-only entry must not plot as a
  // heart rate of zero.
  const vitalSeries = useMemo(
    () =>
      vitals
        .filter(v => v[activeVital] !== null && v[activeVital] !== undefined)
        .map(v => ({
          date: new Date(v.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          [activeVital]: v[activeVital] as number,
          diastolic: v.diastolic ?? undefined,
        })),
    [vitals, activeVital]
  );

  const hasEnoughToChart = vitalSeries.length >= 1;
  const latestValue = hasEnoughToChart
    ? (vitalSeries[vitalSeries.length - 1][activeVital] as number)
    : null;

  // A trend needs two points. With one reading there is nothing to compare to,
  // so show no delta rather than inventing one.
  const delta =
    vitalSeries.length >= 2
      ? Number(
          (
            (vitalSeries[vitalSeries.length - 1][activeVital] as number) -
            (vitalSeries[vitalSeries.length - 2][activeVital] as number)
          ).toFixed(1)
        )
      : null;
  const improved = delta !== null && delta <= 0;

  // ── Appointment history from real data ──────────────────────
  const appointmentHistory = useMemo(() => {
    const today = new Date();
    const months: { month: string; booked: number; cancelled: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ month: MONTHS_SHORT[d.getMonth()], booked: 0, cancelled: 0 });
    }
    appointments.forEach(a => {
      const apptDate = new Date(a.date);
      const diffMonths = (today.getFullYear() - apptDate.getFullYear()) * 12 + (today.getMonth() - apptDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        months[idx].booked++;
        if (a.status === 'cancelled') months[idx].cancelled++;
      }
    });
    return months;
  }, [appointments]);

  const totalBooked    = useMemo(() => appointments.length, [appointments]);
  const totalCancelled = useMemo(() => appointments.filter(a => a.status === 'cancelled').length, [appointments]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-10 space-y-6"
    >
      <div>
        <h2 className="text-2xl font-black text-ink tracking-tight tt">My Health Analytics</h2>
        <p className="text-dim text-sm font-medium mt-0.5 tt">Personal vitals &amp; appointment history at a glance</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Vitals selector + chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-wire p-6 tt">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl border" style={{ background: `${config.color}18`, borderColor: `${config.color}30` }}>
                <Icon className="h-5 w-5" style={{ color: config.color }} />
              </div>
              <div>
                <h3 className="font-black text-ink text-base tt">{config.label}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {latestValue !== null ? (
                    <>
                      <span className="text-2xl font-black" style={{ color: config.color }}>
                        {latestValue}
                      </span>
                      <span className="text-ghost text-xs font-bold tt">{config.unit}</span>
                      {/* A delta needs two readings. With one, there is nothing to compare against. */}
                      {delta !== null && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${improved ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                          {improved ? '▼' : '▲'} {Math.abs(delta)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-ghost text-xs font-bold tt">No readings yet</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Vital selector pills */}
              <div className="flex gap-1 flex-wrap">
                {(Object.keys(VITAL_CONFIG) as VitalKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setActiveVital(k)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      activeVital === k ? 'text-white shadow-md' : 'bg-panel text-ghost hover:text-ink tt'
                    }`}
                    style={activeVital === k ? { background: VITAL_CONFIG[k].color } : {}}
                  >
                    {VITAL_CONFIG[k].label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowRecord(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
              >
                <Plus className="h-3 w-3" />
                Record
              </button>
            </div>
          </div>

          {showRecord && (
            <RecordVitalForm
              onSaved={() => { setShowRecord(false); loadVitals(); }}
              onCancel={() => setShowRecord(false)}
            />
          )}

          {vitalsError && (
            <p className="text-xs font-semibold text-danger mb-3 tt">{vitalsError}</p>
          )}

          {vitalsLoading ? (
            <div className="h-[220px] flex items-center justify-center text-ghost text-xs font-bold tt">
              Loading your readings…
            </div>
          ) : !hasEnoughToChart ? (
            /* Honest empty state. The chart used to be filled with invented
               numbers, which is worse than showing nothing. */
            <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-center">
              <Icon className="h-8 w-8 text-ghost opacity-40" />
              <p className="text-sm font-bold text-dim tt">No {config.label.toLowerCase()} readings yet</p>
              <p className="text-xs text-ghost tt max-w-xs">
                Record a reading and it will appear here. Only readings you enter yourself are shown.
              </p>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={vitalSeries}>
              <defs>
                <linearGradient id={config.gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={config.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-ghost)', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: 'var(--color-ghost)', fontSize: 10 }} axisLine={false} tickLine={false} width={36}
                domain={[config.refLow - 10, config.refHigh + 15]}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={config.refHigh} stroke={config.color} strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Upper', fill: 'var(--color-ghost)', fontSize: 9, fontWeight: 700 }} />
              <ReferenceLine y={config.refLow}  stroke={config.color} strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Lower', fill: 'var(--color-ghost)', fontSize: 9, fontWeight: 700 }} />
              <Area
                type="monotone" dataKey={activeVital} name={config.label}
                stroke={config.color} strokeWidth={2.5}
                fill={`url(#${config.gradient})`}
                dot={{ r: 4, fill: config.color, strokeWidth: 2, stroke: 'var(--color-card)' }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Quick vitals summary cards */}
        <div className="flex flex-col gap-4">
          {(Object.entries(VITAL_CONFIG) as [VitalKey, typeof VITAL_CONFIG[VitalKey]][]).map(([key, cfg]) => {
            // The most recent reading that actually carries this metric.
            const val = [...vitals].reverse().find(v => v[key] !== null && v[key] !== undefined)?.[key] ?? null;
            const inRange = val !== null && val >= cfg.refLow && val <= cfg.refHigh;
            const Ic = cfg.icon;
            return (
              <motion.button
                key={key}
                whileHover={{ scale: 1.02 }}
                onClick={() => setActiveVital(key)}
                className={`bg-card border rounded-2xl p-5 text-left transition-all tt ${activeVital === key ? 'border-opacity-80 shadow-lg' : 'border-wire'}`}
                style={activeVital === key ? { borderColor: cfg.color, boxShadow: `0 4px 24px ${cfg.color}20` } : {}}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl" style={{ background: `${cfg.color}18` }}>
                    <Ic className="h-4 w-4" style={{ color: cfg.color }} />
                  </div>
                  {/* No reading means no verdict. "Normal" against no data is a lie. */}
                  {val !== null && (
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${inRange ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
                      {inRange ? 'Normal' : 'Watch'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest tt">{cfg.label}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  {val !== null ? (
                    <>
                      <span className="text-2xl font-black text-ink tt">{val}</span>
                      <span className="text-xs text-ghost tt">{cfg.unit}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-ghost tt">—</span>
                  )}
                </div>
                {/* mini range bar */}
                <div className="mt-3 h-1.5 bg-panel rounded-full overflow-hidden tt">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      background: cfg.color,
                      width: val === null
                        ? '0%'
                        : `${Math.max(0, Math.min(100, ((val - cfg.refLow) / (cfg.refHigh - cfg.refLow)) * 100))}%`,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Appointment history bar chart — LIVE */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-wire p-6 tt">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                <TrendingDown className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-black text-ink text-base tt">Appointment History</h3>
                <p className="text-ghost text-xs font-medium tt">Bookings vs cancellations over 6 months (live)</p>
              </div>
            </div>
            <div className="flex gap-6">
              {[{ label: 'Total Booked', value: String(totalBooked), color: '#6366f1' }, { label: 'Cancelled', value: String(totalCancelled), color: '#ef4444' }].map(kpi => (
                <div key={kpi.label} className="text-right">
                  <p className="text-[10px] font-black text-ghost uppercase tracking-widest tt">{kpi.label}</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={appointmentHistory} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-wire)', opacity: 0.25, radius: 6 } as object} />
              <Bar dataKey="booked"    name="Booked"     fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelled" name="Cancelled"  fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </motion.div>
  );
}
