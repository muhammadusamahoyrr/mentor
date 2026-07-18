// get_appointment skill — reads a telemedicine appointment from appointment-service
// on the caller's behalf. appointment-service restricts this to the appointment's
// participants, so a 200 back IS the participant check.
const { requireToken, authHeaders } = require('./_serviceUtil');

const BASE = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3002';

const definition = {
  name: 'get_appointment',
  description:
    'Fetch one telemedicine appointment by id — patient, doctor, scheduled time and status. You may only read appointments you are a participant in.',
  input_schema: {
    type: 'object',
    properties: { appointmentId: { type: 'string', description: 'The appointment id.' } },
    required: ['appointmentId'],
  },
};

async function handler({ appointmentId }, ctx) {
  const token = requireToken(ctx);

  let res;
  try {
    res = await fetch(`${BASE}/api/appointments/${encodeURIComponent(appointmentId)}`, {
      headers: authHeaders(token),
    });
  } catch (err) {
    throw new Error(`Could not reach appointment-service: ${err.message}`, { cause: err });
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Not authorized to view this appointment');
  }
  if (res.status === 404) throw new Error('Appointment not found');
  if (!res.ok) throw new Error(`appointment-service returned ${res.status}`);

  return res.json();
}

module.exports = { definition, handler };
