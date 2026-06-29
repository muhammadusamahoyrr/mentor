'use client';
import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/lib/auth';
import { Mail, Lock, User, Stethoscope } from 'lucide-react';
import { RegisterData } from '../../../types/index';
import Logo from '@/components/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterData>({
    name: '', email: '', password: '', role: 'patient', specialization: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(formData);
      router.push(data.user.role === 'doctor' ? '/doctor' : '/patient');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'role' && value !== 'doctor' ? { specialization: '' } : {}),
    }));
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 bg-panel text-ink placeholder:text-ghost border border-wire rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-colors tt';
  const labelCls = 'block text-sm font-bold text-dim mb-2 tt';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 tt">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <Logo withText size="lg" />
          </div>
          <h1 className="text-3xl font-black text-ink tt">Create Account</h1>
          <p className="text-dim mt-1 tt">Join our healthcare platform</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-wire tt">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded-xl text-sm font-semibold">
                {error}
              </div>
            )}

            <div>
              <label className={labelCls}>Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                <input
                  type="text" name="name" required
                  value={formData.name} onChange={handleChange}
                  className={inputCls} placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                <input
                  type="email" name="email" required
                  value={formData.email} onChange={handleChange}
                  className={inputCls} placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                <input
                  type="password" name="password" required
                  value={formData.password} onChange={handleChange}
                  className={inputCls} placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Register as</label>
              <select
                name="role" value={formData.role} onChange={handleChange}
                className="w-full px-4 py-3 bg-panel text-ink border border-wire rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-colors appearance-none tt"
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>

            {formData.role === 'doctor' && (
              <div>
                <label className={labelCls}>Specialization</label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                  <input
                    type="text" name="specialization" required
                    value={formData.specialization} onChange={handleChange}
                    className={inputCls} placeholder="e.g., Cardiology"
                  />
                </div>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dim text-sm tt">
              Already have an account?{' '}
              <Link href="/login" className="text-brand hover:text-brand-hover font-bold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
