'use client';
import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, getCurrentUser } from '@/lib/auth';
import { Mail, Lock } from 'lucide-react';
import { LoginCredentials } from '../../../types/index';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser().then(user => {
      if (!active) return;
      if (user) router.replace(user.role === 'doctor' ? '/doctor' : '/patient');
    });
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(formData);
      router.replace(data.user.role === 'doctor' ? '/doctor' : '/patient');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 bg-panel text-ink placeholder:text-ghost border border-wire rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-colors tt';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 tt">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <Logo withText size="lg" />
          </div>
          <h1 className="text-3xl font-black text-ink tt">Welcome Back</h1>
          <p className="text-dim mt-1 tt">Sign in to continue to your dashboard</p>
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
              <label className="block text-sm font-bold text-dim mb-2 tt">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                <input
                  type="email" name="email" required
                  value={formData.email} onChange={handleChange}
                  className={inputCls}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-dim mb-2 tt">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ghost tt" />
                <input
                  type="password" name="password" required
                  value={formData.password} onChange={handleChange}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dim text-sm tt">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-brand hover:text-brand-hover font-bold">
                Register here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-ghost mt-6 tt">Demo: any email works — or use a registered account.</p>
      </div>
    </div>
  );
}
