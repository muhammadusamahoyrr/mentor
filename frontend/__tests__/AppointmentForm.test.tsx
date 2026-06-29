import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppointmentForm from '../components/AppointmentForm';
import { User, AppointmentFormData } from '../types';

const mockDoctors: User[] = [
  {
    id: 'd-1',
    name: 'Dr. Sarah Chen',
    email: 'sarah@careloop.com',
    role: 'doctor',
    specialization: 'Cardiology',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'd-2',
    name: 'Dr. James Malik',
    email: 'james@careloop.com',
    role: 'doctor',
    specialization: 'Neurology',
    createdAt: '',
    updatedAt: '',
  },
];

const emptyForm: AppointmentFormData = { doctorId: '', date: '', time: '', reason: '' };

describe('AppointmentForm', () => {
  it('renders the heading and all form fields', () => {
    render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        loading={false}
      />
    );

    expect(screen.getByText('Book New Appointment')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/symptoms/i)).toBeInTheDocument();
  });

  it('lists all doctors in the select dropdown', () => {
    render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        loading={false}
      />
    );

    expect(screen.getByText('Dr. Sarah Chen — Cardiology')).toBeInTheDocument();
    expect(screen.getByText('Dr. James Malik — Neurology')).toBeInTheDocument();
  });

  it('shows "Confirm Appointment" button text when not loading', () => {
    render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        loading={false}
      />
    );

    expect(screen.getByText('Confirm Appointment')).toBeInTheDocument();
  });

  it('disables submit button while loading', () => {
    const { container } = render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={vi.fn()}
        onSubmit={vi.fn()}
        loading={true}
      />
    );

    const btn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  it('calls setFormData when reason textarea changes', () => {
    const setFormData = vi.fn();
    render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={setFormData}
        onSubmit={vi.fn()}
        loading={false}
      />
    );

    const textarea = screen.getByPlaceholderText(/symptoms/i);
    fireEvent.change(textarea, { target: { value: 'Chest pain' } });
    expect(setFormData).toHaveBeenCalledWith({ ...emptyForm, reason: 'Chest pain' });
  });

  it('calls onSubmit when the form is submitted', () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    render(
      <AppointmentForm
        doctors={mockDoctors}
        formData={emptyForm}
        setFormData={vi.fn()}
        onSubmit={onSubmit}
        loading={false}
      />
    );

    fireEvent.submit(screen.getByRole('button').closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
