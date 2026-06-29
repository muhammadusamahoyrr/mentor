'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Activity, Image, Download, Trash2, Share2, ChevronDown } from 'lucide-react';
import { MedicalFile, User } from '@/types';

interface FileCardProps {
  file: MedicalFile;
  doctors?: User[];
  onToggleShare?: (id: string, doctorId?: string, doctorName?: string) => void;
  onDelete?: (id: string) => void;
}

const CATEGORY_CONFIG = {
  Prescription: { icon: FileText,  bg: 'bg-indigo-50 border-indigo-100', iconCls: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Lab Result': { icon: Activity,  bg: 'bg-emerald-50 border-emerald-100', iconCls: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  Scan:         { icon: Image,     bg: 'bg-amber-50 border-amber-100',  iconCls: 'text-amber-600',  badge: 'bg-amber-100 text-amber-800 border-amber-200' },
} as const;

export default function FileCard({ file, doctors = [], onToggleShare, onDelete }: FileCardProps) {
  const [showDoctorSelect, setShowDoctorSelect] = useState(false);
  const config = CATEGORY_CONFIG[file.category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.Prescription;
  const Icon = config.icon;

  const handleDownload = () => {
    const content = `==================================================
CARELOOP MEDICAL EHR DOCUMENT VAULT
==================================================
Document ID:   ${file.id}
Name:          ${file.name}
Category:      ${file.category}
Uploaded:      ${new Date(file.uploadedAt).toLocaleString()}
Sharing:       ${file.sharedWithDoctor ? 'Shared with doctor' : 'Private'}
==================================================`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '') + '_decrypted.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggle = () => {
    if (!onToggleShare) return;
    if (file.sharedWithDoctor) { onToggleShare(file.id); return; }
    if (doctors.length > 0) setShowDoctorSelect(p => !p);
    else onToggleShare(file.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-card border border-wire rounded-2xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden group tt"
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${config.bg} border flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}>
          <Icon className={`h-6 w-6 ${config.iconCls}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-ink font-bold text-base truncate pr-6 tt" title={file.name}>
            {file.name}
          </h4>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-ghost text-xs font-semibold tt">
              {file.size} • {new Date(file.uploadedAt).toLocaleDateString()}
            </p>
            {file.patientName && (
              <p className="text-brand text-[10px] font-black uppercase tracking-tight">
                From: {file.patientName}
              </p>
            )}
          </div>
          <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 mt-2 rounded-md border ${config.badge}`}>
            {file.category}
          </span>
        </div>
      </div>

      {file.doctorComments && (
        <div className="mt-1 p-3 bg-brand-muted border border-brand-border rounded-xl text-xs text-brand font-semibold leading-relaxed flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">💬</span>
          <div>
            <span className="text-[10px] font-black text-brand/60 block uppercase tracking-wider mb-0.5 leading-none">Doctor Note</span>
            &quot;{file.doctorComments}&quot;
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-haze flex flex-col gap-3 tt">
        <div className="flex items-center justify-between gap-3">
          {onToggleShare && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  file.sharedWithDoctor ? 'bg-brand' : 'bg-wire'
                }`}
                aria-label="Share with doctor"
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${
                  file.sharedWithDoctor ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
              <span className="text-xs font-bold text-dim flex flex-col tt">
                <span className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  {file.sharedWithDoctor ? 'Shared' : 'Private'}
                </span>
                {file.sharedWithDoctor && file.doctorName && (
                  <span className="text-[9px] text-brand truncate max-w-[100px]">
                    with {file.doctorName}
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              className="p-2 bg-panel hover:bg-brand-muted text-ghost hover:text-brand rounded-lg border border-haze transition-colors tt"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </motion.button>

            {onDelete && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDelete(file.id)}
                className="p-2 bg-panel hover:bg-danger-light text-ghost hover:text-danger rounded-lg border border-haze transition-colors tt"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showDoctorSelect && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-panel rounded-xl border border-wire tt"
            >
              <p className="text-[10px] font-black text-ghost uppercase tracking-widest p-3 pb-1">Select Doctor</p>
              <div className="max-h-32 overflow-y-auto p-1 flex flex-col gap-1">
                {doctors.map(doctor => (
                  <button
                    key={doctor.id}
                    onClick={() => { onToggleShare?.(file.id, doctor.id, doctor.name); setShowDoctorSelect(false); }}
                    className="flex items-center justify-between p-2 hover:bg-card hover:shadow-sm rounded-lg text-left transition-all group/doc tt"
                  >
                    <div>
                      <p className="text-xs font-bold text-ink group-hover/doc:text-brand tt">{doctor.name}</p>
                      <p className="text-[10px] text-ghost font-medium tt">{doctor.specialization || 'Specialist'}</p>
                    </div>
                    <ChevronDown className="h-3 w-3 text-ghost -rotate-90" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
