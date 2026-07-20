const getAppointment = require('../agent/tools/getAppointment');
const listPatientFiles = require('../agent/tools/listPatientFiles');
const readPatientFile = require('../agent/tools/readPatientFile');
const memory = require('../memory/session');

// Minimal fetch Response stub.
function res({ status = 200, json, buffer, contentType }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => contentType },
    json: async () => json,
    arrayBuffer: async () => buffer,
  };
}

afterEach(() => {
  delete global.fetch;
});

describe('platform skills forward the caller token and fail closed without it', () => {
  it('get_appointment refuses when there is no token in context', async () => {
    await expect(getAppointment.handler({ appointmentId: 'a1' }, {})).rejects.toThrow(/no token/);
  });

  it('get_appointment forwards the bearer token and returns the appointment', async () => {
    global.fetch = jest.fn(async (url, opts) => {
      expect(opts.headers.Authorization).toBe('Bearer tok123');
      return res({ json: { id: 'a1', status: 'confirmed' } });
    });
    const out = await getAppointment.handler({ appointmentId: 'a1' }, { token: 'tok123' });
    expect(out).toEqual({ id: 'a1', status: 'confirmed' });
  });

  it('get_appointment maps 403 to an authorization error', async () => {
    global.fetch = jest.fn(async () => res({ status: 403 }));
    await expect(getAppointment.handler({ appointmentId: 'a1' }, { token: 't' })).rejects.toThrow(
      /Not authorized/
    );
  });

  it('list_patient_files normalises the file list', async () => {
    global.fetch = jest.fn(async () =>
      res({ json: [{ _id: 'f1', fileName: 'labs.pdf', patientId: 'p1', uploadedAt: 'x' }] })
    );
    const out = await listPatientFiles.handler({}, { token: 't' });
    expect(out.count).toBe(1);
    expect(out.files[0]).toEqual({ id: 'f1', fileName: 'labs.pdf', patientId: 'p1', uploadedAt: 'x' });
  });

  it('read_patient_file extracts text and is binary-safe (arrayBuffer, not text)', async () => {
    global.fetch = jest.fn(async () =>
      res({ contentType: 'text/plain', buffer: Buffer.from('BP 150/95', 'utf8') })
    );
    const out = await readPatientFile.handler({ fileId: 'f1' }, { token: 't' });
    expect(out.text).toContain('150/95');
    expect(out.contentType).toContain('text/plain');
  });

  it('read_patient_file maps 403 (not shared) to access denied', async () => {
    global.fetch = jest.fn(async () => res({ status: 403 }));
    await expect(readPatientFile.handler({ fileId: 'f1' }, { token: 't' })).rejects.toThrow(
      /not shared/
    );
  });
});

describe('session memory (in-process fallback when Redis is down)', () => {
  it('recalls an empty session, then remembers a Q/A turn across calls', async () => {
    const id = `sess-${Date.now()}`;
    expect((await memory.recall(id)).history).toEqual([]);

    await memory.appendTurn(id, 'What is the BP?', '150/95', { ownerId: 'doc1' });
    const after = await memory.recall(id);

    expect(after.history).toHaveLength(2);
    expect(after.history[0]).toEqual({ role: 'user', content: 'What is the BP?' });
    expect(after.history[1]).toEqual({ role: 'assistant', content: '150/95' });
    expect(after.ownerId).toBe('doc1');
  });
});
