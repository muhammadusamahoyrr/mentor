'use client';
import { useState, useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { TrendingUp, BarChart2, PieChart as PieIcon } from 'lucide-react';
import { Appointment } from '@/types';

/* ── Shared custom tooltip ───────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-wire rounded-xl px-4 py-3 shadow-xl text-xs tt">
      <p className="font-black text-ink mb-2 uppercase tracking-wider tt">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-dim capitalize tt">{p.name}:</span>
          <span className="font-bold text-ink ml-auto tt">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Section header ─────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2.5 bg-brand-muted rounded-xl border border-brand-border">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <div>
        <h3 className="font-black text-ink text-base tt">{title}</h3>
        <p className="text-ghost text-xs font-medium tt">{subtitle}</p>
      </div>
    </div>
  );
}

interface DoctorAnalyticsProps {
  appointments?: Appointment[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DoctorAnalytics({ appointments = [] }: DoctorAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const uid = useId();

  const tabs = [
    { key: 'week' as const, label: 'This Week' },
    { key: 'month' as const, label: '6 Months' },
  ];

  // ── Derived from real appointments ─────────────────────────

  const weeklyData = useMemo(() => {
    const today = new Date();
    // Build a map for the last 7 days (today and prior 6)
    const map: Record<string, { day: string; confirmed: number; pending: number; completed: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      map[key] = { day: DAYS[d.getDay()], confirmed: 0, pending: 0, completed: 0 };
    }

    appointments.forEach(a => {
      if (map[a.date]) {
        if (a.status === 'confirmed')  map[a.date].confirmed++;
        if (a.status === 'pending')    map[a.date].pending++;
        if (a.status === 'completed')  map[a.date].completed++;
      }
    });

    return Object.values(map);
  }, [appointments]);

  const statusDistribution = useMemo(() => {
    const counts = { confirmed: 0, pending: 0, completed: 0, cancelled: 0 };
    appointments.forEach(a => { if (a.status in counts) counts[a.status as keyof typeof counts]++; });
    return [
      { name: 'Confirmed',  value: counts.confirmed,  color: '#10b981' },
      { name: 'Pending',    value: counts.pending,    color: '#f59e0b' },
      { name: 'Completed',  value: counts.completed,  color: '#3b82f6' },
      { name: 'Cancelled',  value: counts.cancelled,  color: '#ef4444' },
    ];
  }, [appointments]);

  // Six-month trend, built entirely from real appointments.
  //
  // This used to also chart "revenue", computed as `revenue += 150` — a
  // hardcoded guess at a consultation fee. No fee, price or rate exists on any
  // model in this system, so that money figure was invented and then rendered on
  // a dashboard where it looked authoritative. It is gone.
  //
  // It also fell back to a mock array whenever there were no appointments, which
  // showed a doctor with no bookings a chart of somebody's fictional ones.
  const monthlyTrend = useMemo(() => {
    const today = new Date();
    const months: { month: string; patients: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ month: MONTHS_SHORT[d.getMonth()], patients: 0 });
    }
    appointments.forEach(a => {
      const apptDate = new Date(a.date);
      const diffMonths = (today.getFullYear() - apptDate.getFullYear()) * 12 + (today.getMonth() - apptDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        months[5 - diffMonths].patients++;
      }
    });
    return months;
  }, [appointments]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-10 space-y-6"
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-ink tracking-tight tt">Practice Analytics</h2>
          <p className="text-dim text-sm font-medium mt-0.5 tt">Live insights from your appointment pipeline</p>
        </div>
        {/* Tab switcher */}
        <div className="flex bg-panel p-1 rounded-xl border border-wire tt">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === t.key ? 'bg-card text-brand shadow-sm border border-wire tt' : 'text-ghost hover:text-ink'
              } tt`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Appointment volume — Bar / Area */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-wire p-6 tt">
          <SectionHeader
            icon={BarChart2}
            title="Appointment Volume"
            subtitle={activeTab === 'week' ? 'Confirmed · Pending · Completed per day (live)' : 'Appointments per month (live)'}
          />
          <ResponsiveContainer width="100%" height={240}>
            {activeTab === 'week' ? (
              <BarChart data={weeklyData} barSize={10} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-wire)', opacity: 0.3, radius: 6 } as object} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 16 }} />
                <Bar dataKey="confirmed" name="confirmed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending"   name="pending"   fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id={`${uid}-gradPatients`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 16 }} />
                <Area type="monotone" dataKey="patients" name="patients" stroke="#3b82f6" strokeWidth={2} fill={`url(#${uid}-gradPatients)`} dot={{ r: 3, fill: '#3b82f6' }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Status donut — live */}
        <div className="bg-card rounded-2xl border border-wire p-6 flex flex-col tt">
          <SectionHeader icon={PieIcon} title="Case Distribution" subtitle="By appointment status (live)" />
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
              {statusDistribution.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-ghost uppercase tracking-wider truncate tt">{s.name}</p>
                    <p className="text-sm font-black text-ink leading-tight tt">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Patient trend — full width line */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-wire p-6 tt">
          <SectionHeader
            icon={TrendingUp}
            title="Patient Growth Trend"
            subtitle="Total appointments over the past 6 months"
          />
          <div className="flex items-end gap-8 mb-6">
            {(() => {
              const total = monthlyTrend.reduce((acc, m) => acc + m.patients, 0);
              const avg   = monthlyTrend.length > 0 ? Math.round(total / monthlyTrend.length) : 0;
              const peak  = [...monthlyTrend].sort((a, b) => b.patients - a.patients)[0]?.month ?? '—';
              const first = monthlyTrend[0]?.patients ?? 0;
              const last  = monthlyTrend[monthlyTrend.length - 1]?.patients ?? 0;
              const growth = first > 0 ? `+${Math.round(((last - first) / first) * 100)}%` : '—';
              return [
                { label: 'Avg / month', value: String(avg),   color: 'text-brand' },
                { label: 'Peak month',  value: peak,           color: 'text-success' },
                { label: 'Growth',      value: growth,         color: 'text-success' },
              ].map(kpi => (
                <div key={kpi.label}>
                  <p className="text-[10px] font-black text-ghost uppercase tracking-widest tt">{kpi.label}</p>
                  <p className={`text-2xl font-black mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                </div>
              ));
            })()}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={monthlyTrend}>
              <defs>
                <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone" dataKey="patients" name="patients"
                stroke="url(#lineGlow)" strokeWidth={2.5}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </motion.div>
  );
}
