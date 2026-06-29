import { User, LoginCredentials, RegisterData, AuthResponse, Appointment, AppNotification, MedicalFile } from '../types/index';
import { MOCK_DOCTORS, MOCK_APPOINTMENTS_PATIENT, MOCK_APPOINTMENTS_DOCTOR, MOCK_NOTIFICATIONS, MOCK_FILES } from './mockData';

const USER_KEY          = 'careloop_user';
const REGISTERED_KEY    = 'careloop_registered';
const APPOINTMENTS_KEY  = 'careloop_appointments';
const NOTIFICATIONS_KEY = 'careloop_notifications';
const FILES_KEY         = 'careloop_files';

// Demo IDs that seed from mock data
const DEMO_PATIENT_IDS = new Set(['p-1', 'p-demo']);
const DEMO_DOCTOR_ID   = 'd-1';

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ── Auth ─────────────────────────────────────────────────────

export const getCurrentUser = async (): Promise<User | null> => {
  if (typeof window === 'undefined') return null;
  return safeJsonParse<User | null>(localStorage.getItem(USER_KEY), null);
};

export const getAvailableDoctors = (): User[] => {
  if (typeof window === 'undefined') return MOCK_DOCTORS;
  const registered = safeJsonParse<(User & { password: string })[]>(
    localStorage.getItem(REGISTERED_KEY), []
  );
  const registeredDoctors: User[] = registered
    .filter(u => u.role === 'doctor')
    .map(({ password: _, ...u }) => u as User);
  const emailsSeen = new Set(registeredDoctors.map(d => d.email));
  const mockFallbacks = MOCK_DOCTORS.filter(d => !emailsSeen.has(d.email));
  return [...registeredDoctors, ...mockFallbacks];
};

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  await new Promise(r => setTimeout(r, 400));

  const registered: (User & { password: string })[] = safeJsonParse(
    localStorage.getItem(REGISTERED_KEY), []
  );
  const found = registered.find(
    u => u.email === credentials.email && u.password === credentials.password
  );
  const doctorDemo = MOCK_DOCTORS.find(d => d.email === credentials.email);

  let user: User;
  if (found) {
    const { password: _, ...rest } = found;
    user = rest as User;
  } else if (doctorDemo && credentials.password) {
    user = doctorDemo;
  } else if (credentials.email && credentials.password) {
    user = {
      id: 'p-demo',
      name: credentials.email.split('@')[0],
      email: credentials.email,
      role: 'patient',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    throw { response: { data: { message: 'Invalid credentials' } } };
  }

  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return { user, token: 'mock-token' };
};

export const register = async (userData: RegisterData): Promise<AuthResponse> => {
  await new Promise(r => setTimeout(r, 400));

  const registered = safeJsonParse<(User & { password: string })[]>(
    localStorage.getItem(REGISTERED_KEY), []
  );

  if (registered.some(u => u.email === userData.email)) {
    throw { response: { data: { message: 'An account with this email already exists.' } } };
  }

  const user: User = {
    id: `user-${Date.now()}`,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    specialization: userData.role === 'doctor' ? userData.specialization : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  registered.push({ ...user, password: userData.password });
  localStorage.setItem(REGISTERED_KEY, JSON.stringify(registered));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return { user, token: 'mock-token' };
};

export const logout = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  }
};

// ── Appointments ─────────────────────────────────────────────

export const saveAppointment = (appointment: Appointment): void => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
  existing.push(appointment);
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(existing));
};

export const updateAppointmentStatus = (id: string, status: Appointment['status']): void => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
  const idx = existing.findIndex(a => a.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], status, updatedAt: new Date().toISOString() };
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(existing));
  }
};

export const getAppointmentsForPatient = (userId: string): Appointment[] => {
  if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_APPOINTMENTS_PATIENT : [];
  const saved = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
  const mine = saved.filter(a => a.patientId === userId);
  // Only seed mock demo appointments for the demo patient ids
  const mockFallback = DEMO_PATIENT_IDS.has(userId) ? MOCK_APPOINTMENTS_PATIENT : [];
  return [...mine, ...mockFallback];
};

export const getAppointmentsForDoctor = (userId: string): Appointment[] => {
  if (typeof window === 'undefined') return userId === DEMO_DOCTOR_ID ? MOCK_APPOINTMENTS_DOCTOR : [];
  const saved = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
  const mine = saved.filter(a => a.doctorId === userId);
  // Only seed mock demo appointments for the original demo doctor
  const mockFallback = userId === DEMO_DOCTOR_ID ? MOCK_APPOINTMENTS_DOCTOR : [];
  return [...mine, ...mockFallback];
};

// ── Notifications ─────────────────────────────────────────────

export const saveNotification = (notification: AppNotification): void => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  existing.unshift(notification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing));
};

export const getNotificationsForUser = (userId: string): AppNotification[] => {
  if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_NOTIFICATIONS : [];
  const saved = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  const mine = saved.filter(n => n.userId === userId);
  // Seed mock notifications only for demo patient accounts
  const mockFallback = DEMO_PATIENT_IDS.has(userId) ? MOCK_NOTIFICATIONS : [];
  return [...mine, ...mockFallback];
};

export const markNotificationRead = (id: string): void => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  const idx = existing.findIndex(n => n.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], read: true };
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing));
  }
};

export const markAllNotificationsRead = (userId: string): void => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  const updated = existing.map(n => n.userId === userId ? { ...n, read: true } : n);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
};

// ── Files ─────────────────────────────────────────────────────

type FileStore = Record<string, MedicalFile[]>;

export const getFilesForUser = (userId: string): MedicalFile[] => {
  if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_FILES : [];
  const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
  // If user has no entry yet, seed demo patients with mock files
  if (!(userId in store)) {
    return DEMO_PATIENT_IDS.has(userId) ? MOCK_FILES : [];
  }
  return store[userId];
};

export const saveFilesForUser = (userId: string, files: MedicalFile[]): void => {
  if (typeof window === 'undefined') return;
  const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
  store[userId] = files;
  localStorage.setItem(FILES_KEY, JSON.stringify(store));
};

export const getFilesSharedWithDoctor = (): MedicalFile[] => {
  if (typeof window === 'undefined') return MOCK_FILES.filter(f => f.sharedWithDoctor);
  const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
  const savedFiles = Object.values(store).flat().filter(f => f.sharedWithDoctor);
  const savedIds = new Set(savedFiles.map(f => f.id));
  // Include mock shared files whose ids aren't in any patient's saved store
  const mockFallback = MOCK_FILES.filter(f => f.sharedWithDoctor && !savedIds.has(f.id));
  return [...savedFiles, ...mockFallback];
};

export const updateFileInStorage = (file: MedicalFile): void => {
  if (typeof window === 'undefined' || !file.patientId) return;
  const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
  const userFiles = store[file.patientId] ?? (DEMO_PATIENT_IDS.has(file.patientId) ? [...MOCK_FILES] : []);
  const idx = userFiles.findIndex(f => f.id === file.id);
  if (idx !== -1) {
    userFiles[idx] = file;
  } else {
    userFiles.unshift(file);
  }
  store[file.patientId] = userFiles;
  localStorage.setItem(FILES_KEY, JSON.stringify(store));
};
