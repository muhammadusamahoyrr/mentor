'use client';
import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { TrendingUp, Users, BarChart2, PieChart as PieIcon } from 'lucide-react';
import {
  MOCK_WEEKLY_APPOINTMENTS,
  MOCK_MONTHLY_TREND,
  MOCK_STATUS_DISTRIBUTION,
} from '@/lib/mockData';

/* ── Shared custom tooltip ───────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-wire rounded-xl px-4 py-3 shadow-xl text-xs tt">
      <p className="font-black text-ink mb-2 uppercase tracking-wider tt">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-dim capitalize tt">{p.name}:</span>
          <span className="font-bold text-ink ml-auto tt">
            {p.dataKey === 'revenue' ? `$${p.value.toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Section header ─────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
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

export default function DoctorAnalytics() {
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const uid = useId();

  const tabs = [
    { key: 'week' as const, label: 'This Week' },
    { key: 'month' as const, label: '6 Months' },
  ];

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
            subtitle={activeTab === 'week' ? 'Confirmed · Pending · Completed per day' : 'New patients & revenue per month'}
          />
          <ResponsiveContainer width="100%" height={240}>
            {activeTab === 'week' ? (
              <BarChart data={MOCK_WEEKLY_APPOINTMENTS} barSize={10} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-wire)', opacity: 0.3, radius: 6 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 16 }} />
                <Bar dataKey="confirmed" name="confirmed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending"   name="pending"   fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={MOCK_MONTHLY_TREND}>
                <defs>
                  <linearGradient id={`${uid}-gradPatients`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${uid}-gradRevenue`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-wire)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-ghost)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-ghost)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 16 }} />
                <Area yAxisId="left"  type="monotone" dataKey="patients" name="patients" stroke="#3b82f6" strokeWidth={2} fill={`url(#${uid}-gradPatients)`} dot={{ r: 3, fill: '#3b82f6' }} />
                <Area yAxisId="right" type="monotone" dataKey="revenue"  name="revenue"  stroke="#10b981" strokeWidth={2} fill={`url(#${uid}-gradRevenue)`}  dot={{ r: 3, fill: '#10b981' }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Status donut */}
        <div className="bg-card rounded-2xl border border-wire p-6 flex flex-col tt">
          <SectionHeader icon={PieIcon} title="Case Distribution" subtitle="By appointment status" />
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={MOCK_STATUS_DISTRIBUTION}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {MOCK_STATUS_DISTRIBUTION.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
              {MOCK_STATUS_DISTRIBUTION.map(s => (
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
            subtitle="Total new patients over the past 6 months"
          />
          <div className="flex items-end gap-8 mb-6">
            {[
              { label: 'Avg / month', value: '50', color: 'text-brand' },
              { label: 'Peak month',  value: 'May',    color: 'text-success' },
              { label: 'Growth',      value: '+50%',   color: 'text-success' },
            ].map(kpi => (
              <div key={kpi.label}>
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest tt">{kpi.label}</p>
                <p className={`text-2xl font-black mt-0.5 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={MOCK_MONTHLY_TREND}>
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
