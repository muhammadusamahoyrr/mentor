'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FolderOpen, CheckCircle } from 'lucide-react';
import { User, MedicalFile } from '@/types';
import { getCurrentUser, getFilesForUser, saveFilesForUser, uploadFileToService, toggleFileShare, deleteFileFromService } from '@/lib/auth';
import FileCard from './FileCard';
import FileFilters, { FileCategoryFilter } from './FileFilters';
import FileDropzone from './FileDropzone';

interface FileVaultProps {
  doctors?: User[];
  externalFiles?: MedicalFile[];
  onExternalFilesChange?: React.Dispatch<React.SetStateAction<MedicalFile[]>>;
}

export default function FileVault({ doctors = [], externalFiles, onExternalFilesChange }: FileVaultProps) {
  const [internalFiles, setInternalFiles] = useState<MedicalFile[]>([]);
  const [activeFilter, setActiveFilter] = useState<FileCategoryFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When external state is provided (doctor page lifts state), use it; otherwise own state.
  const files = (externalFiles && user?.role === 'doctor') ? externalFiles : internalFiles;
  const setFiles = (externalFiles && user?.role === 'doctor' && onExternalFilesChange)
    ? onExternalFilesChange
    : setInternalFiles;

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    let active = true;
    getCurrentUser().then(async u => {
      if (!active) return;
      setUser(u);
      if (u?.role === 'patient') {
        try {
          const list = await getFilesForUser(u.id);
          if (active) setInternalFiles(list);
        } catch (err) {
          console.error('Failed to load patient vault files:', err);
        }
      }
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const persistFiles = (updater: (prev: MedicalFile[]) => MedicalFile[]) => {
    if (user?.role === 'patient') {
      const next = updater(internalFiles);
      saveFilesForUser(user.id, next);
      setInternalFiles(next);
    } else {
      setFiles(updater);
    }
  };

  const handleFileAccepted = async (file: File) => {
    let category: 'Prescription' | 'Lab Result' | 'Scan' = 'Prescription';
    const nameLower = file.name.toLowerCase();

    if (nameLower.includes('blood') || nameLower.includes('lab') || nameLower.includes('report') || nameLower.includes('test')) {
      category = 'Lab Result';
    } else if (file.type.startsWith('image/') || nameLower.includes('xray') || nameLower.includes('scan') || nameLower.includes('mri')) {
      category = 'Scan';
    }

    const sizeInMB = file.size / (1024 * 1024);
    const size = sizeInMB < 0.1
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${sizeInMB.toFixed(1)} MB`;

    try {
      const uploadedFile = await uploadFileToService({
        fileName: file.name,
        fileSize: file.size,
        fileSizeFormatted: size,
        category,
        mimeType: file.type || 'application/octet-stream',
        fileUrl: `/mock-vault/${Date.now()}-${file.name}`
      });
      setInternalFiles(prev => [uploadedFile, ...prev]);
      showToast(`${file.name} uploaded successfully.`);
    } catch (err) {
      console.warn('Backend file-service offline, falling back to mock...');
      const newFile: MedicalFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        size,
        category,
        uploadedAt: new Date().toISOString(),
        sharedWithDoctor: false,
        patientName: user?.name,
        patientEmail: user?.email,
        patientId: user?.id || 'p-demo',
      };
      setInternalFiles(prev => [newFile, ...prev]);
      saveFilesForUser(user?.id || 'p-demo', [newFile, ...internalFiles]);
      showToast(`${file.name} uploaded (local mock mode).`);
    }
  };

  const handleToggleShare = async (id: string, doctorId?: string, doctorName?: string) => {
    try {
      const updated = await toggleFileShare(id, doctorId, doctorName);
      setInternalFiles(prev => prev.map(f => f.id === id ? updated : f));
      if (onExternalFilesChange) {
        onExternalFilesChange(prev => prev.map(f => f.id === id ? updated : f));
      }
      showToast(updated.sharedWithDoctor ? 'Shared file with doctor.' : 'Unshared file.');
    } catch {
      console.warn('Backend file share offline, falling back to mock...');
      persistFiles(prev => prev.map(f =>
        f.id === id
          ? { ...f, sharedWithDoctor: !f.sharedWithDoctor, doctorId, doctorName }
          : f
      ));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document from your vault?')) return;
    try {
      await deleteFileFromService(id);
      setInternalFiles(prev => prev.filter(f => f.id !== id));
      if (onExternalFilesChange) {
        onExternalFilesChange(prev => prev.filter(f => f.id !== id));
      }
      showToast('Document deleted successfully.');
    } catch {
      console.warn('Backend file delete offline, deleting locally...');
      persistFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const filteredFiles = files.filter(f => activeFilter === 'All' || f.category === activeFilter);

  if (isLoading) {
    return (
      <div className="bg-card rounded-[3rem] shadow-sm border border-wire overflow-hidden p-8 sm:p-10 flex flex-col gap-8 w-full mt-10 min-h-[350px] tt">
        <div className="h-10 w-64 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-4 w-96 bg-slate-100 rounded-lg animate-pulse -mt-4" />
        <div className="grid md:grid-cols-3 gap-8 items-start mt-4">
          <div className="h-44 bg-slate-50 border border-slate-200/50 rounded-[2rem] animate-pulse" />
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="h-10 w-96 bg-slate-100 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-32 bg-slate-50 border border-slate-200/50 rounded-2xl animate-pulse" />
              <div className="h-32 bg-slate-50 border border-slate-200/50 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-[3rem] shadow-sm border border-wire overflow-hidden p-8 sm:p-10 flex flex-col gap-8 w-full mt-10 relative tt">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 min-w-[320px]"
          >
            <div className="bg-emerald-500 p-1 rounded-lg">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-haze tt">
        <div>
          <h2 className="text-3xl font-black text-ink tracking-tight flex items-center gap-3 tt">
            <span>Visual Document Vault</span>
            <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>EHR Ready</span>
            </div>
          </h2>
          <p className="text-dim font-medium mt-1 tt">
            {user?.role === 'doctor'
              ? 'View and manage medical documents shared by your patients.'
              : 'Securely upload prescriptions, lab reports, and scans. Control doctor sharing preferences.'}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {user?.role === 'patient' && (
          <div className="md:col-span-1">
            <FileDropzone onFileAccepted={handleFileAccepted} />
          </div>
        )}
        <div className={`flex flex-col gap-6 w-full ${user?.role === 'patient' ? 'md:col-span-2' : 'md:col-span-3'}`}>
          <FileFilters activeFilter={activeFilter} onChangeFilter={setActiveFilter} />

          <div className="min-h-[200px]">
            <AnimatePresence mode="popLayout">
              {filteredFiles.length > 0 ? (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredFiles.map(file => (
                    <FileCard
                      key={file.id}
                      file={file}
                      doctors={doctors}
                      onToggleShare={user?.role === 'patient' ? handleToggleShare : undefined}
                      onDelete={user?.role === 'patient' ? handleDelete : undefined}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-panel/50 rounded-[2rem] border border-haze min-h-[240px] tt"
                >
                  <div className="p-4 bg-card rounded-2xl shadow-sm border border-haze text-ghost mb-4 tt">
                    <FolderOpen className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-ink text-base tt">No files found</h4>
                  <p className="text-ghost text-sm mt-1 max-w-xs tt">
                    {user?.role === 'doctor'
                      ? 'No files have been shared with you yet.'
                      : 'No documents in this category yet.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
