'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { getCurrentUser, getAppointmentsForDoctor, updateAppointmentStatus, saveNotification, getFilesSharedWithDoctor } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import AppointmentList from '@/components/AppointmentList';
import Skeleton from '@/components/Skeleton';
import { Calendar, Clock, CheckCircle, Activity, Users, TrendingUp, Search, X } from 'lucide-react';
import { User, Appointment } from '@/types';
import { useRouter } from 'next/navigation';
import FileVault from '@/components/vault/FileVault';
import DoctorAnalytics from '@/components/analytics/DoctorAnalytics';
import CalendarModal from '@/components/CalendarModal';
import { MedicalFile } from '@/types';

export default function DoctorDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorFiles, setDoctorFiles] = useState<MedicalFile[]>([]);
  const doctorSharedFiles = useMemo(() => doctorFiles.filter(f => f.sharedWithDoctor), [doctorFiles]);

  const handleSharedFilesChange = useCallback(
    (updater: (prev: MedicalFile[]) => MedicalFile[]) => {
      setDoctorFiles(prevAll => {
        const updatedShared = updater(prevAll.filter(f => f.sharedWithDoctor));
        const byId = new Map(updatedShared.map(f => [f.id, f]));
        return prevAll.map(f => byId.get(f.id) ?? f);
      });
    },
    [],
  );
  const [filter, setFilter] = useState<Appointment['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getCurrentUser().then(async u => {
      if (!active) return;
      if (!u) { router.push('/login'); return; }
      setUser(u);
      try {
        const [appts, files] = await Promise.all([
          getAppointmentsForDoctor(u.id),
          getFilesSharedWithDoctor(),
        ]);
        if (!active) return;
        setAppointments(appts);
        setDoctorFiles(files);
      } catch (err) {
        console.error('Failed to load doctor dashboard data:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  const handleStatusUpdate = async (id: string, status: 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const updatedAppt = await updateAppointmentStatus(id, status);
      const appt = appointments.find(a => a.id === id) || updatedAppt;
      if (appt?.patientId) {
        const labels: Record<typeof status, string> = {
          confirmed: 'confirmed',
          cancelled: 'cancelled',
          completed: 'marked as completed',
        };
        await saveNotification({
          id: `notif-${Date.now()}`,
          userId: appt.patientId,
          title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Dr. ${user?.name ?? 'Your doctor'} has ${labels[status]} your appointment on ${appt.date} at ${appt.time}.`,
          type: 'status_change',
          read: false,
          appointmentId: id,
          createdAt: new Date().toISOString(),
        });
      }
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status, videoUrl: updatedAppt.videoUrl } : a)
      );
    } catch (err) {
      console.error('Failed to update status on the backend:', err);
    }
  };

  const filteredAppointments = appointments.filter(a => {
    const matchesFilter = filter === 'all' || a.status === filter;
    const matchesSearch = searchQuery === '' ||
      a.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 100 } },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface tt">
        <Navbar user={null} />
        <main className="max-w-7xl mx-auto px-4 py-10">
          <Skeleton className="h-12 w-64 mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <Skeleton className="h-32" count={4} />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
        >
          <div>
            <h1 className="text-4xl font-black text-ink tracking-tight tt">
              Welcome back, <span className="text-blue-600">Dr. {user?.name?.split(' ')[0]}</span>
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-dim text-lg font-medium flex items-center gap-2 tt">
                <Activity className="h-5 w-5 text-emerald-500" />
                You have {stats.pending} pending requests for today.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 glass px-4 py-2 rounded-2xl">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-dim tt">Performance +12%</span>
            </div>
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-2xl">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-ink uppercase tracking-tighter tt">System Live</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
        >
          <StatCard variants={itemVariants} title="Total Patients" value={stats.total} icon={<Users />} color="blue" />
          <StatCard variants={itemVariants} title="New Requests" value={stats.pending} icon={<Clock />} color="yellow" />
          <StatCard variants={itemVariants} title="Approved" value={stats.confirmed} icon={<CheckCircle />} color="emerald" />
          <StatCard variants={itemVariants} title="Completed" value={stats.completed} icon={<Activity />} color="indigo" />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-1 space-y-6"
          >
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Calendar className="h-32 w-32" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Schedule View</h2>
              <p className="text-slate-400 text-sm mb-6">Quickly glance at your weekly availability and booked slots.</p>
              <button
                onClick={() => setCalendarOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95"
              >
                Open Calendar
                <Calendar className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-card rounded-3xl p-8 border border-wire shadow-sm tt">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2 tt">
                  <Search className="h-5 w-5 text-blue-500" />
                  Quick Search
                </h3>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-panel rounded-full transition tt">
                    <X className="h-4 w-4 text-ghost tt" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Patient name or reason..."
                className="w-full bg-panel text-ink placeholder:text-ghost border-2 border-transparent rounded-2xl py-3 pl-4 pr-10 focus:bg-card focus:border-brand/20 focus:ring-4 focus:ring-brand/5 outline-none transition-all font-medium tt"
              />
              {searchQuery && (
                <p className="mt-3 text-[10px] font-bold text-blue-500 uppercase tracking-widest animate-pulse">
                  Filtering Pipeline Results...
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-card rounded-[2.5rem] shadow-sm border border-wire overflow-hidden flex flex-col h-full tt">
              <div className="p-8 border-b border-haze bg-panel/50 tt">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-2xl font-black text-ink tracking-tight tt">Appointment Pipeline</h2>
                    <p className="text-dim text-sm mt-1 font-medium italic tt">
                      {searchQuery ? `Showing results for "${searchQuery}"` : `Showing ${filteredAppointments.length} sessions`}
                    </p>
                  </div>
                  <div className="flex bg-card p-1.5 rounded-[1.25rem] border border-wire shadow-sm overflow-x-auto tt">
                    {(['all', 'pending', 'confirmed', 'completed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          filter === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-ghost hover:text-ink'
                        } tt`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={filter + searchQuery}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    {filteredAppointments.length > 0 ? (
                      <AppointmentList
                        appointments={filteredAppointments}
                        role="doctor"
                        onAction={handleStatusUpdate}
                        sharedFiles={doctorSharedFiles}
                        onSharedFilesChange={handleSharedFilesChange}
                      />
                    ) : (
                      <div className="py-20 text-center">
                        <Search className="h-12 w-12 text-wire mx-auto mb-4 tt" />
                        <h3 className="text-lg font-bold text-ink tt">No matches found</h3>
                        <p className="text-dim tt">Try adjusting your search or filters.</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>

        <DoctorAnalytics appointments={appointments} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <FileVault externalFiles={doctorFiles} onExternalFilesChange={setDoctorFiles} />
        </motion.div>
      </main>

      <AnimatePresence>
        {calendarOpen && (
          <CalendarModal
            appointments={appointments}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactElement<{ className?: string }>;
  color: 'blue' | 'yellow' | 'emerald' | 'indigo';
  variants: Variants;
}

function StatCard({ title, value, icon, color, variants }: StatCardProps) {
  const colorMap: Record<StatCardProps['color'], string> = {
    blue:    'bg-card text-blue-600    border-blue-100/80    hover:border-blue-300    hover:shadow-blue-500/10    tt',
    yellow:  'bg-card text-amber-600   border-amber-100/80   hover:border-amber-300   hover:shadow-amber-500/10   tt',
    emerald: 'bg-card text-emerald-600 border-emerald-100/80 hover:border-emerald-300 hover:shadow-emerald-500/10 tt',
    indigo:  'bg-card text-indigo-600  border-indigo-100/80  hover:border-indigo-300  hover:shadow-indigo-500/10  tt',
  };
  const iconBg: Record<StatCardProps['color'], string> = {
    blue: 'bg-blue-50', yellow: 'bg-amber-50', emerald: 'bg-emerald-50', indigo: 'bg-indigo-50',
  };

  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`p-6 rounded-3xl border shadow-sm transition-all duration-300 hover:shadow-xl ${colorMap[color as keyof typeof colorMap]}`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className={`p-3 ${iconBg[color as keyof typeof iconBg]} rounded-2xl`}>
          {React.cloneElement(icon, { className: 'h-5 w-5' })}
        </div>
        <div className="h-1.5 w-14 bg-current opacity-10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '65%' }}
            transition={{ delay: 0.5, duration: 1 }}
            className="h-full bg-current opacity-40"
          />
        </div>
      </div>
      <h3 className="text-ghost text-[10px] font-black uppercase tracking-widest tt">{title}</h3>
      <p className="text-4xl font-black text-ink mt-1 tracking-tight tt">{value}</p>
    </motion.div>
  );
}
