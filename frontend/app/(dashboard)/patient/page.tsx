'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser, getAvailableDoctors, saveAppointment, getAppointmentsForPatient, updateAppointmentStatus, saveNotification } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import AppointmentList from '@/components/AppointmentList';
import AppointmentForm from '@/components/AppointmentForm';
import Skeleton from '@/components/Skeleton';
import { Heart, Shield, Activity, CheckCircle, ArrowRight } from 'lucide-react';
import { User, Appointment, AppointmentFormData } from '@/types';
import FileVault from '@/components/vault/FileVault';
import PatientAnalytics from '@/components/analytics/PatientAnalytics';

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({
    doctorId: '', date: '', time: '', reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCurrentUser().then(async u => {
      if (!active) return;
      if (!u) { router.push('/login'); return; }
      setUser(u);
      try {
        const [docs, appts] = await Promise.all([
          getAvailableDoctors(),
          getAppointmentsForPatient(u.id),
        ]);
        if (!active) return;
        setDoctors(docs);
        setAppointments(appts);
      } catch (err) {
        console.error('Failed to load user records from microservices:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      const doctor = doctors.find(d => d.id === formData.doctorId);
      const newAppointment: Appointment = {
        id: `appt-${Date.now()}`,
        patientId: user?.id || 'p-demo',
        doctorId: formData.doctorId,
        date: formData.date,
        time: formData.time,
        reason: formData.reason,
        status: 'pending',
        doctor,
        patient: user || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedAppt = await saveAppointment(newAppointment);
      // Notify the doctor
      if (doctor) {
        await saveNotification({
          id: `notif-${Date.now()}`,
          userId: doctor.id,
          title: 'New Appointment Request',
          message: `${user?.name ?? 'A patient'} requested an appointment on ${formData.date} at ${formData.time}.`,
          type: 'appointment',
          read: false,
          appointmentId: savedAppt.id,
          createdAt: new Date().toISOString(),
        });
      }
      setAppointments(prev => [savedAppt, ...prev]);
      setFormData({ doctorId: '', date: '', time: '', reason: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await updateAppointmentStatus(id, 'cancelled');
      const appt = appointments.find(a => a.id === id);
      if (appt?.doctorId) {
        await saveNotification({
          id: `notif-${Date.now()}`,
          userId: appt.doctorId,
          title: 'Appointment Cancelled',
          message: `${user?.name ?? 'A patient'} cancelled their appointment on ${appt.date} at ${appt.time}.`,
          type: 'status_change',
          read: false,
          appointmentId: id,
          createdAt: new Date().toISOString(),
        });
      }
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a)
      );
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface tt">
        <Navbar user={null} />
        <main className="max-w-7xl mx-auto px-4 py-10">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid lg:grid-cols-3 gap-10">
            <Skeleton className="h-[600px] lg:col-span-1" />
            <Skeleton className="h-[600px] lg:col-span-2" />
          </div>
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
          className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <h1 className="text-4xl font-black text-ink tracking-tight tt">
              Hello, <span className="text-blue-600">{user?.name?.split(' ')[0]}!</span>
            </h1>
            <p className="text-dim mt-2 text-lg font-medium tt">Your health journey is our top priority.</p>
          </div>

          <div className="flex gap-4">
            <div className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Heart className="h-5 w-5 text-emerald-600 fill-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest leading-none tt">Vitals</p>
                <p className="text-lg font-black text-ink leading-tight tt">Stable</p>
              </div>
            </div>
            <div className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest leading-none tt">Activity</p>
                <p className="text-lg font-black text-ink leading-tight tt">Active</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-1"
          >
            <div className="sticky top-28">
              <AppointmentForm
                doctors={doctors}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                loading={loading}
              />

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="mt-6 bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden group shadow-2xl"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                  <Shield className="h-24 w-24" />
                </div>
                <h3 className="text-lg font-bold mb-2">Need Help?</h3>
                <p className="text-slate-400 text-sm mb-4">Our support team is available 24/7 for medical emergencies.</p>
                <div className="flex items-center text-blue-400 font-black text-sm cursor-pointer">
                  Contact Support <ArrowRight className="h-4 w-4 ml-1" />
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-card rounded-[3rem] shadow-sm border border-wire overflow-hidden min-h-[700px] flex flex-col tt">
              <div className="p-10 border-b border-haze flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 tt">
                <div>
                  <h2 className="text-3xl font-black text-ink tracking-tight tt">Your Care Pipeline</h2>
                  <p className="text-dim font-medium mt-1 tt">Manage your active and past medical sessions</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-ghost uppercase tracking-widest leading-none tt">Total</p>
                    <p className="text-xl font-black text-ink leading-tight tt">{appointments.length}</p>
                  </div>
                </div>
              </div>

              <div className="p-10 flex-1 overflow-y-auto max-h-[700px] custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <AppointmentList
                      appointments={appointments}
                      role="patient"
                      onAction={handleCancel}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>

        <PatientAnalytics appointments={appointments} />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <FileVault doctors={doctors} />
        </motion.div>
      </main>
    </div>
  );
}
