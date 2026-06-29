'use client';
import { motion } from 'framer-motion';

export type FileCategoryFilter = 'All' | 'Prescription' | 'Lab Result' | 'Scan';

interface FileFiltersProps {
  activeFilter: FileCategoryFilter;
  onChangeFilter: (filter: FileCategoryFilter) => void;
}

export default function FileFilters({ activeFilter, onChangeFilter }: FileFiltersProps) {
  const tabs: { label: string; value: FileCategoryFilter }[] = [
    { label: 'All Files',      value: 'All' },
    { label: 'Prescriptions',  value: 'Prescription' },
    { label: 'Lab Results',    value: 'Lab Result' },
    { label: 'Scans & Images', value: 'Scan' },
  ];

  return (
    <div className="flex bg-panel p-1.5 rounded-2xl w-full max-w-lg self-center sm:self-start border border-wire tt">
      {tabs.map(tab => {
        const isActive = activeFilter === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChangeFilter(tab.value)}
            className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-black tracking-wide uppercase transition-colors relative focus:outline-none select-none cursor-pointer ${
              isActive ? 'text-brand' : 'text-ghost hover:text-ink'
            } tt`}
          >
            <span className="relative z-10">{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="active-filter-pill"
                className="absolute inset-0 bg-card rounded-xl shadow-sm border border-wire/30 tt"
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
