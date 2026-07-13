import { User, LoginCredentials, RegisterData, AuthResponse, Appointment, AppNotification, MedicalFile } from '../types/index';
import { MOCK_DOCTORS, MOCK_APPOINTMENTS_PATIENT, MOCK_APPOINTMENTS_DOCTOR, MOCK_NOTIFICATIONS, MOCK_FILES } from './mockData';
import api from './api';

const USER_KEY          = 'careloop_user';
const REGISTERED_KEY    = 'careloop_registered';
const APPOINTMENTS_KEY  = 'careloop_appointments';
const NOTIFICATIONS_KEY = 'careloop_notifications';
const FILES_KEY         = 'careloop_files';

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

// ── Client-Server Property Adapters ─────────────────────────

const transformFile = (dbFile: unknown): MedicalFile => {
  if (!dbFile || typeof dbFile !== 'object') return {} as MedicalFile;
  const f = dbFile as Record<string, unknown>;
  return {
    id: String(f._id || f.id || ''),
    name: String(f.fileName || f.name || ''),
    size: String(f.fileSizeFormatted || f.size || ''),
    category: (f.category || 'Prescription') as MedicalFile['category'],
    uploadedAt: String(f.uploadedAt || f.createdAt || new Date().toISOString()),
    sharedWithDoctor: Boolean(f.sharedWithDoctor),
    fileUrl: String(f.fileUrl || ''),
    doctorComments: String(f.doctorComments || ''),
    doctorId: String(f.doctorId || ''),
    doctorName: String(f.doctorName || ''),
    patientName: String(f.patientName || ''),
    patientEmail: String(f.patientEmail || ''),
    patientId: String(f.patientId || ''),
  };
};

const transformNotification = (dbNotif: unknown): AppNotification => {
  if (!dbNotif || typeof dbNotif !== 'object') return {} as AppNotification;
  const n = dbNotif as Record<string, unknown>;
  return {
    id: String(n._id || n.id || ''),
    _id: String(n._id || ''),
    userId: String(n.userId || ''),
    title: String(n.title || ''),
    message: String(n.message || ''),
    type: (n.type || 'appointment') as AppNotification['type'],
    read: Boolean(n.read),
    appointmentId: n.appointmentId ? String(n.appointmentId) : undefined,
    data: n.data as AppNotification['data'],
    createdAt: String(n.createdAt || new Date().toISOString()),
  };
};

// ── Auth ─────────────────────────────────────────────────────

export const getCurrentUser = async (): Promise<User | null> => {
  if (typeof window === 'undefined') return null;
  try {
    const res = await api.get<{ user: User }>('/api/auth/me');
    const user = res.data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    // If backend reports unauthorized/expired, wipe local session
    if (
      err &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status === 401
    ) {
      localStorage.removeItem(USER_KEY);
      return null;
    }
    // Fall back to cached local storage session if server is offline
    return safeJsonParse<User | null>(localStorage.getItem(USER_KEY), null);
  }
};

export const getAvailableDoctors = async (): Promise<User[]> => {
  try {
    const res = await api.get<User[]>('/api/auth/doctors');
    return res.data;
  } catch {
    // Fallback to local mocks
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
  }
};

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const res = await api.post<{ user: User; message?: string }>('/api/auth/login', credentials);
    const user = res.data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { user, token: 'cookie-session-token' };
  } catch (err) {
    // Rethrow operational 4xx response validation warnings directly
    const error = err as { response?: { status?: number } };
    if (error.response && error.response.status && error.response.status >= 400 && error.response.status < 500) {
      throw err;
    }
    console.warn('Authentication service offline, falling back to mock login...');
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
  }
};

export const register = async (userData: RegisterData): Promise<AuthResponse> => {
  try {
    const res = await api.post<{ user: User }>('/api/auth/register', userData);
    const user = res.data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { user, token: 'cookie-session-token' };
  } catch (err) {
    const error = err as { response?: { status?: number } };
    if (error.response && error.response.status && error.response.status >= 400 && error.response.status < 500) {
      throw err;
    }
    console.warn('Authentication service offline, falling back to mock registration...');
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
  }
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    console.warn('Logout request failed or auth-service offline:', err);
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  }
};

// ── Appointments ─────────────────────────────────────────────

export const saveAppointment = async (appointment: Partial<Appointment>): Promise<Appointment> => {
  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: appointment.doctorId,
        date: appointment.date,
        time: appointment.time,
        reason: appointment.reason,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Appointment service offline, saving mock appointment...');
    const appt: Appointment = {
      id: appointment.id || `appt-${Date.now()}`,
      patientId: appointment.patientId || 'p-demo',
      doctorId: appointment.doctorId || '',
      date: appointment.date || '',
      time: appointment.time || '',
      reason: appointment.reason || '',
      status: appointment.status || 'pending',
      doctor: appointment.doctor,
      patient: appointment.patient,
      createdAt: appointment.createdAt || new Date().toISOString(),
      updatedAt: appointment.updatedAt || new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      const existing = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
      existing.push(appt);
      localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(existing));
    }
    return appt;
  }
};

export const updateAppointmentStatus = async (id: string, status: Appointment['status']): Promise<Appointment> => {
  try {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Appointment service offline, updating mock status...');
    if (typeof window !== 'undefined') {
      const existing = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
      const idx = existing.findIndex(a => a.id === id);
      if (idx !== -1) {
        existing[idx] = { ...existing[idx], status, updatedAt: new Date().toISOString() };
        localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(existing));
      }
    }
    return { id, status } as Appointment;
  }
};

export const getAppointmentsForPatient = async (userId: string): Promise<Appointment[]> => {
  try {
    const res = await fetch('/api/appointments/my');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Appointment service offline, reading mock patient appointments...');
    if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_APPOINTMENTS_PATIENT : [];
    const saved = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
    const mine = saved.filter(a => a.patientId === userId);
    const mockFallback = DEMO_PATIENT_IDS.has(userId) ? MOCK_APPOINTMENTS_PATIENT : [];
    return [...mine, ...mockFallback];
  }
};

export const getAppointmentsForDoctor = async (userId: string): Promise<Appointment[]> => {
  try {
    const res = await fetch('/api/appointments/my');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Appointment service offline, reading mock doctor appointments...');
    if (typeof window === 'undefined') return userId === DEMO_DOCTOR_ID ? MOCK_APPOINTMENTS_DOCTOR : [];
    const saved = safeJsonParse<Appointment[]>(localStorage.getItem(APPOINTMENTS_KEY), []);
    const mine = saved.filter(a => a.doctorId === userId);
    const mockFallback = userId === DEMO_DOCTOR_ID ? MOCK_APPOINTMENTS_DOCTOR : [];
    return [...mine, ...mockFallback];
  }
};

// ── Notifications ─────────────────────────────────────────────

/**
 * Records a notification locally for the acting user's own bell.
 *
 * This used to POST to /api/notifications/events, which creates a notification
 * for an arbitrary userId — from the browser, that meant anyone could forge a
 * notification for anyone. It was also redundant: booking an appointment or
 * changing its status already emits appointment.created / appointment.updated
 * through appointment-service's transactional outbox, and notification-service
 * fans those out to the right people over the socket. The event endpoint is now
 * service-to-service only.
 */
export const saveNotification = async (notification: AppNotification): Promise<void> => {
  if (typeof window === 'undefined') return;
  const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
  existing.unshift(notification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing));
};

export const getNotificationsForUser = async (userId: string): Promise<AppNotification[]> => {
  try {
    const res = await fetch('/api/notifications/my');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return Array.isArray(list) ? list.map(transformNotification) : [];
  } catch (err) {
    console.warn('Notification service offline, reading mock user notifications...');
    if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_NOTIFICATIONS : [];
    const saved = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
    const mine = saved.filter(n => n.userId === userId);
    const mockFallback = DEMO_PATIENT_IDS.has(userId) ? MOCK_NOTIFICATIONS : [];
    return [...mine, ...mockFallback];
  }
};

export const markNotificationRead = async (id: string): Promise<void> => {
  try {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.warn('Notification service offline, marking mock notification as read...');
    if (typeof window === 'undefined') return;
    const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
    const idx = existing.findIndex(n => n.id === id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], read: true };
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing));
    }
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  try {
    await fetch('/api/notifications/mark-all-read', { method: 'PATCH' });
  } catch (err) {
    console.warn('Notification service offline, marking all mock notifications as read...');
    if (typeof window === 'undefined') return;
    const existing = safeJsonParse<AppNotification[]>(localStorage.getItem(NOTIFICATIONS_KEY), []);
    const updated = existing.map(n => n.userId === userId ? { ...n, read: true } : n);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  }
};

// ── Files ─────────────────────────────────────────────────────

type FileStore = Record<string, MedicalFile[]>;

export const getFilesForUser = async (userId: string): Promise<MedicalFile[]> => {
  try {
    const res = await fetch('/api/files/my');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return Array.isArray(list) ? list.map(transformFile) : [];
  } catch (err) {
    console.warn('File service offline, reading mock user files...');
    if (typeof window === 'undefined') return DEMO_PATIENT_IDS.has(userId) ? MOCK_FILES : [];
    const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
    if (!(userId in store)) {
      return DEMO_PATIENT_IDS.has(userId) ? MOCK_FILES : [];
    }
    return store[userId];
  }
};

export const saveFilesForUser = async (userId: string, files: MedicalFile[]): Promise<void> => {
  if (typeof window === 'undefined') return;
  const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
  store[userId] = files;
  localStorage.setItem(FILES_KEY, JSON.stringify(store));
};

export const getFilesSharedWithDoctor = async (): Promise<MedicalFile[]> => {
  try {
    const res = await fetch('/api/files/my');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return Array.isArray(list) ? list.map(transformFile) : [];
  } catch (err) {
    console.warn('File service offline, reading mock shared doctor files...');
    if (typeof window === 'undefined') return MOCK_FILES.filter(f => f.sharedWithDoctor);
    const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
    const savedFiles = Object.values(store).flat().filter(f => f.sharedWithDoctor);
    const savedIds = new Set(savedFiles.map(f => f.id));
    const mockFallback = MOCK_FILES.filter(f => f.sharedWithDoctor && !savedIds.has(f.id));
    return [...savedFiles, ...mockFallback];
  }
};

export const updateFileInStorage = async (file: MedicalFile): Promise<MedicalFile> => {
  try {
    const url = file.doctorComments !== undefined && file.doctorComments !== null
      ? `/api/files/${file.id}/comments`
      : `/api/files/${file.id}/share`;

    const body = file.doctorComments !== undefined && file.doctorComments !== null
      ? { comments: file.doctorComments }
      : { doctorId: file.doctorId, doctorName: file.doctorName };

    const res = await fetch(url, {
      method: file.doctorComments !== undefined && file.doctorComments !== null ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return transformFile(data);
  } catch (err) {
    console.warn('File service offline, updating mock file local status...');
    if (typeof window !== 'undefined' && file.patientId) {
      const store = safeJsonParse<FileStore>(localStorage.getItem(FILES_KEY), {});
      const userFiles = store[file.patientId] ?? (DEMO_PATIENT_IDS.has(file.patientId) ? [...MOCK_FILES] : []);
      const idx = userFiles.findIndex(f => f.id === file.id);
      if (idx !== -1) {
        userFiles[idx] = file;
      } else {
        userFiles.unshift(file);
      }
      store[file.patientId] = userFiles;
      localStorage.setItem(FILES_KEY, JSON.stringify(userFiles));
    }
    return file;
  }
};

// ── File Upload Helper ────────────────────────────────────────

export const uploadFileToService = async (fileData: {
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  category: string;
  mimeType: string;
  fileUrl: string;
}): Promise<MedicalFile> => {
  const res = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fileData),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return transformFile(data);
};

export const toggleFileShare = async (id: string, doctorId?: string, doctorName?: string): Promise<MedicalFile> => {
  const res = await fetch(`/api/files/${id}/share`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctorId, doctorName }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return transformFile(data);
};

export const addDoctorComment = async (id: string, comments: string): Promise<MedicalFile> => {
  const res = await fetch(`/api/files/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return transformFile(data);
};

export const deleteFileFromService = async (id: string): Promise<void> => {
  const res = await fetch(`/api/files/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};
