'use client';
import { useRouter } from 'next/navigation';
import { LogOut, Sun, Moon } from 'lucide-react';
import { logout } from '@/lib/auth';
import { useTheme } from '@/contexts/ThemeContext';
import NotificationBell from './NotificationBell';
import Logo from './Logo';
import { User } from '../types/index';

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      router.push('/login');
    }
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-wire/40 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between h-20">

          {/* Left: logo + role label */}
          <div className="flex items-center gap-4">
            <Logo withText size="md" />
            <div className="hidden lg:block ml-2 pl-4 border-l border-wire">
              <span className="text-[10px] font-black text-ghost uppercase tracking-widest tt">
                {user?.role === 'doctor' ? 'Doctor View' : 'Patient View'}
              </span>
            </div>
          </div>

          {/* Right: user chip + controls */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-panel rounded-2xl border border-wire/50 tt">
              <div className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center">
                <span className="text-brand font-bold text-xs">{user?.name?.charAt(0)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-ink leading-none tt">{user?.name}</span>
                <span className="text-[10px] font-bold text-ghost uppercase mt-1 tt">{user?.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-xl text-ghost hover:text-ink hover:bg-panel tt transition-colors active:scale-95"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <NotificationBell userId={user?.id} />

              <div className="w-px h-8 bg-wire mx-2 tt" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-dim hover:text-danger hover:bg-danger-light/60 rounded-xl font-bold transition-colors active:scale-95 tt"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
