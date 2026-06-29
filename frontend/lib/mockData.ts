import { User, Appointment, MedicalFile, AppNotification } from '@/types';

export const MOCK_DOCTORS: User[] = [
  {
    id: 'd-1', name: 'Dr. Sarah Chen', email: 'sarah@careloop.com',
    role: 'doctor', specialization: 'Cardiology',
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'd-2', name: 'Dr. James Malik', email: 'james@careloop.com',
    role: 'doctor', specialization: 'Neurology',
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'd-3', name: 'Dr. Ayesha Khan', email: 'ayesha@careloop.com',
    role: 'doctor', specialization: 'General Practice',
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
];

const MOCK_PATIENT: User = {
  id: 'p-1', name: 'Alex Johnson', email: 'alex@example.com',
  role: 'patient', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
};

export const MOCK_APPOINTMENTS_PATIENT: Appointment[] = [
  {
    id: 'appt-1', patientId: 'p-1', doctorId: 'd-1',
    date: '2026-07-10', time: '10:00',
    reason: 'Routine cardiac check-up and blood pressure monitoring.',
    status: 'confirmed',
    doctor: MOCK_DOCTORS[0],
    patient: MOCK_PATIENT,
    createdAt: '2026-06-28T00:00:00Z', updatedAt: '2026-06-28T00:00:00Z',
  },
  {
    id: 'appt-2', patientId: 'p-1', doctorId: 'd-2',
    date: '2026-07-15', time: '14:30',
    reason: 'Follow-up for recurring headaches and dizziness.',
    status: 'pending',
    doctor: MOCK_DOCTORS[1],
    patient: MOCK_PATIENT,
    createdAt: '2026-06-28T00:00:00Z', updatedAt: '2026-06-28T00:00:00Z',
  },
];

export const MOCK_APPOINTMENTS_DOCTOR: Appointment[] = [
  {
    id: 'appt-1', patientId: 'p-1', doctorId: 'd-1',
    date: '2026-07-10', time: '10:00',
    reason: 'Routine cardiac check-up and blood pressure monitoring.',
    status: 'confirmed',
    doctor: MOCK_DOCTORS[0],
    patient: MOCK_PATIENT,
    createdAt: '2026-06-28T00:00:00Z', updatedAt: '2026-06-28T00:00:00Z',
  },
  {
    id: 'appt-3', patientId: 'p-2', doctorId: 'd-1',
    date: '2026-07-11', time: '09:00',
    reason: 'Chest pain and shortness of breath evaluation.',
    status: 'pending',
    doctor: MOCK_DOCTORS[0],
    patient: { id: 'p-2', name: 'Maria Garcia', email: 'maria@example.com', role: 'patient', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    createdAt: '2026-06-28T00:00:00Z', updatedAt: '2026-06-28T00:00:00Z',
  },
  {
    id: 'appt-4', patientId: 'p-3', doctorId: 'd-1',
    date: '2026-07-08', time: '11:30',
    reason: 'Post-surgery follow-up and medication review.',
    status: 'completed',
    doctor: MOCK_DOCTORS[0],
    patient: { id: 'p-3', name: 'Omar Sheikh', email: 'omar@example.com', role: 'patient', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    createdAt: '2026-06-27T00:00:00Z', updatedAt: '2026-06-27T00:00:00Z',
  },
  {
    id: 'appt-5', patientId: 'p-4', doctorId: 'd-1',
    date: '2026-07-10', time: '16:00',
    reason: 'Annual wellness check. Patient requested rescheduling.',
    status: 'cancelled',
    doctor: MOCK_DOCTORS[0],
    patient: { id: 'p-4', name: 'Fatima Noor', email: 'fatima@example.com', role: 'patient', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    createdAt: '2026-06-26T00:00:00Z', updatedAt: '2026-06-28T00:00:00Z',
  },
];

export const MOCK_FILES: MedicalFile[] = [
  {
    id: 'file-1', name: 'Blood_Panel_June2026.pdf',
    size: '1.2 MB', category: 'Lab Result',
    uploadedAt: '2026-06-20T10:00:00Z', sharedWithDoctor: true,
    patientName: 'Alex Johnson', patientEmail: 'alex@example.com', patientId: 'p-1',
  },
  {
    id: 'file-2', name: 'Chest_XRay_2026.jpg',
    size: '3.4 MB', category: 'Scan',
    uploadedAt: '2026-06-22T14:00:00Z', sharedWithDoctor: false,
    patientName: 'Alex Johnson', patientEmail: 'alex@example.com', patientId: 'p-1',
  },
  {
    id: 'file-3', name: 'Prescription_Lisinopril.pdf',
    size: '0.3 MB', category: 'Prescription',
    uploadedAt: '2026-06-25T09:00:00Z', sharedWithDoctor: true,
    doctorComments: 'Continue dosage as prescribed. Schedule follow-up in 3 months.',
    patientName: 'Alex Johnson', patientEmail: 'alex@example.com', patientId: 'p-1',
  },
];

/* ── Analytics mock data ─────────────────────────────────── */

export const MOCK_WEEKLY_APPOINTMENTS = [
  { day: 'Mon', confirmed: 4, pending: 2, completed: 1 },
  { day: 'Tue', confirmed: 6, pending: 3, completed: 2 },
  { day: 'Wed', confirmed: 3, pending: 5, completed: 4 },
  { day: 'Thu', confirmed: 8, pending: 1, completed: 3 },
  { day: 'Fri', confirmed: 5, pending: 4, completed: 6 },
  { day: 'Sat', confirmed: 2, pending: 2, completed: 2 },
  { day: 'Sun', confirmed: 1, pending: 0, completed: 1 },
];

export const MOCK_MONTHLY_TREND = [
  { month: 'Jan', patients: 38, revenue: 7200 },
  { month: 'Feb', patients: 45, revenue: 8500 },
  { month: 'Mar', patients: 52, revenue: 9100 },
  { month: 'Apr', patients: 48, revenue: 8800 },
  { month: 'May', patients: 61, revenue: 11200 },
  { month: 'Jun', patients: 57, revenue: 10500 },
];

export const MOCK_STATUS_DISTRIBUTION = [
  { name: 'Confirmed',  value: 38, color: '#10b981' },
  { name: 'Pending',    value: 24, color: '#f59e0b' },
  { name: 'Completed',  value: 52, color: '#3b82f6' },
  { name: 'Cancelled',  value: 8,  color: '#ef4444' },
];

export const MOCK_VITALS_TREND = [
  { date: 'Jun 1',  heartRate: 72, systolic: 118, diastolic: 76, weight: 74.2 },
  { date: 'Jun 5',  heartRate: 75, systolic: 122, diastolic: 80, weight: 74.0 },
  { date: 'Jun 10', heartRate: 70, systolic: 115, diastolic: 74, weight: 73.8 },
  { date: 'Jun 15', heartRate: 68, systolic: 119, diastolic: 77, weight: 73.5 },
  { date: 'Jun 20', heartRate: 73, systolic: 121, diastolic: 79, weight: 73.7 },
  { date: 'Jun 25', heartRate: 71, systolic: 116, diastolic: 75, weight: 73.4 },
  { date: 'Jun 28', heartRate: 69, systolic: 114, diastolic: 73, weight: 73.2 },
];

export const MOCK_APPOINTMENT_HISTORY = [
  { month: 'Jan', booked: 1, cancelled: 0 },
  { month: 'Feb', booked: 2, cancelled: 1 },
  { month: 'Mar', booked: 1, cancelled: 0 },
  { month: 'Apr', booked: 3, cancelled: 0 },
  { month: 'May', booked: 2, cancelled: 1 },
  { month: 'Jun', booked: 2, cancelled: 0 },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1', userId: 'current',
    title: 'Appointment Confirmed',
    message: 'Dr. Sarah Chen confirmed your appointment on July 10 at 10:00 AM.',
    type: 'appointment', read: false,
    appointmentId: 'appt-1',
    createdAt: '2026-06-28T08:00:00Z',
  },
  {
    id: 'notif-2', userId: 'current',
    title: 'Clinical Note Added',
    message: 'Dr. Sarah Chen left a clinical note on your Prescription file.',
    type: 'file_shared', read: true,
    createdAt: '2026-06-27T15:30:00Z',
  },
];
