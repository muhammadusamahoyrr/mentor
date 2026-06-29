'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  onFileAccepted: (file: File) => void;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function FileDropzone({ onFileAccepted }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, []);

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMsg(msg);
    errorTimerRef.current = setTimeout(() => { setErrorMsg(null); errorTimerRef.current = null; }, 5000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const processFile = (file: File) => {
    if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null; }
    setErrorMsg(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError('Unsupported format. Please upload PDF, JPEG, PNG or DOCX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('File too large. Maximum size allowed is 10 MB.');
      return;
    }
    onFileAccepted(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <motion.div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[180px] bg-panel hover:bg-lift tt ${
          isDragActive
            ? 'border-brand bg-brand-muted/30 scale-[0.99] ring-4 ring-brand/10'
            : 'border-wire hover:border-dim'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        />

        <motion.div
          animate={isDragActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
          className={`p-4 rounded-2xl mb-4 transition-colors ${
            isDragActive
              ? 'bg-brand-muted text-brand'
              : 'bg-card text-ghost shadow-sm border border-haze tt'
          }`}
        >
          <UploadCloud className="h-8 w-8" />
        </motion.div>

        <h3 className="font-bold text-ink text-base tt">
          {isDragActive ? 'Drop your file here' : 'Upload Medical Document'}
        </h3>
        <p className="text-ghost text-sm mt-1 max-w-sm tt">
          Drag & drop here or{' '}
          <span className="text-brand font-bold hover:underline">browse files</span>.
          {' '}Supports PDF, PNG, JPG, DOCX (max 10 MB).
        </p>

        {isDragActive && (
          <motion.div
            className="absolute inset-0 border-2 border-brand rounded-[2rem] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1 }}
          />
        )}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 p-4 bg-danger-light border border-danger/20 text-danger rounded-xl text-sm font-semibold"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
