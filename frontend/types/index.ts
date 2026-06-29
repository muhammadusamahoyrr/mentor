export interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
  specialization?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;               // mapped from _id
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  videoUrl?: string | null;
  patient?: User;           // populated patient object
  doctor?: User;            // populated doctor object
  createdAt: string;
  updatedAt: string;
}


export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'appointment' | 'reminder' | 'status_change' | 'file_shared';
  read: boolean;
  appointmentId?: string;
  data?: {
    videoUrl?: string | null;
    fileId?: string;
  };
  createdAt: string;
  _id?: string; // Add _id since MongoDB uses it
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'doctor';
  specialization?: string;
}

export interface AppointmentFormData {
  doctorId: string;
  date: string;
  time: string;
  reason: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

export interface MedicalFile {
  id: string;
  name: string;
  size: string; // e.g., "2.4 MB"
  category: 'Prescription' | 'Lab Result' | 'Scan';
  uploadedAt: string;
  sharedWithDoctor: boolean;
  fileUrl?: string;
  doctorComments?: string;
  doctorId?: string;
  doctorName?: string;
  patientName?: string;
  patientEmail?: string;
  patientId?: string;
}