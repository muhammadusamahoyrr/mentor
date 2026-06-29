'use client';
import { motion } from 'framer-motion';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
}

export default function Logo({ className = '', size = 'md', withText = false }: LogoProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div 
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        className={`relative ${sizes[size]}`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Main Loop Path - Creating a heart shape with an infinity twist */}
          <motion.path
            d="M20 34C20 34 5 26 5 15C5 9.5 9.5 5 15 5C17.5 5 19 6 20 8C21 6 22.5 5 25 5C30.5 5 35 9.5 35 15C35 26 20 34 20 34Z"
            stroke="url(#logo-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          
          {/* Inner "Loop" Sparkle */}
          <motion.circle 
            cx="20" 
            cy="15" 
            r="3" 
            fill="#2563eb"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 1, duration: 0.5 }}
          />

          <defs>
            <linearGradient id="logo-gradient" x1="5" y1="5" x2="35" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Subtle Pulse background */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-blue-600 rounded-full blur-xl -z-10"
        />
      </motion.div>

      {withText && (
        <div className="flex flex-col">
          <span className={`font-black tracking-tight leading-none text-slate-900 ${
            size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-3xl'
          }`}>
            Care<span className="text-blue-600">Loop</span>
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
              Infinite Health
            </span>
          )}
        </div>
      )}
    </div>
  );
}
