const { AppError } = require('../middleware/errorHandler');

const APPOINTMENT_SERVICE =
  process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3002';

/**
 * Fetch an appointment on behalf of the caller.
 *
 * notes-service has no appointment data of its own (separate SQLite DB), so it
 * cannot decide who is allowed to read a consultation's notes. appointment-service
 * already restricts GET /api/appointments/:id to the patient and doctor on the
 * appointment — so forwarding the caller's token and getting a 200 back *is* the
 * participant check. A 403/404 means they have no business here.
 *
 * Returns the appointment payload (including the embedded `doctor` object).
 */
async function fetchAppointmentForUser(appointmentId, token) {
  let response;
  try {
    response = await fetch(
      `${APPOINTMENT_SERVICE}/api/appointments/${appointmentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `token=${token}`,
        },
      }
    );
  } catch (err) {
    throw new AppError(
      `Could not reach appointment-service: ${err.message}`,
      503
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError('Not authorized to access notes for this appointment', 403);
  }
  if (response.status === 404) {
    throw new AppError('Appointment not found', 404);
  }
  if (!response.ok) {
    throw new AppError(
      `appointment-service returned ${response.status}`,
      502
    );
  }

  return response.json();
}

module.exports = { fetchAppointmentForUser };
