'use client';
import { User, AppointmentFormData } from '@/types';
import { Calendar as CalendarIcon, Clock, User as UserIcon, FileText, Send } from 'lucide-react';

interface AppointmentFormProps {
  doctors: User[];
  formData: AppointmentFormData;
  setFormData: (data: AppointmentFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function AppointmentForm({ doctors, formData, setFormData, onSubmit, loading }: AppointmentFormProps) {
  const inputCls = 'w-full px-4 py-3 bg-panel text-ink border border-wire rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-colors placeholder:text-ghost tt';
  const labelCls = 'block text-sm font-bold text-dim mb-2 flex items-center gap-2 tt';

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-wire overflow-hidden tt">
      {/* gradient header stays brand-coloured in both modes */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Book New Appointment
        </h2>
        <p className="text-blue-100 text-sm mt-1">Fill in the details to request a visit</p>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-5">
        <div>
          <label className={labelCls}>
            <UserIcon className="h-4 w-4 text-brand" />
            Select Specialist
          </label>
          <select
            required
            value={formData.doctorId}
            onChange={e => setFormData({ ...formData, doctorId: e.target.value })}
            className={inputCls + ' appearance-none'}
          >
            <option value="">Choose a doctor</option>
            {doctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} — {doctor.specialization}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              <CalendarIcon className="h-4 w-4 text-brand" />
              Date
            </label>
            <input
              type="date" required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              min={new Date().toLocaleDateString('en-CA')}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <Clock className="h-4 w-4 text-brand" />
              Time
            </label>
            <input
              type="time" required
              value={formData.time}
              onChange={e => setFormData({ ...formData, time: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>
            <FileText className="h-4 w-4 text-brand" />
            Reason for Visit
          </label>
          <textarea
            required
            value={formData.reason}
            onChange={e => setFormData({ ...formData, reason: e.target.value })}
            rows={4}
            className={inputCls + ' resize-none'}
            placeholder="Please describe your symptoms or reason for the visit..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
        >
          {loading ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="h-5 w-5" />
              Confirm Appointment
            </>
          )}
        </button>
      </form>
    </div>
  );
}
