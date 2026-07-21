const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');

// Ask the clinical research agent a question. Doctors only: it can read patient
// files, vitals and appointments on the caller's behalf, so it is a clinician
// tool, not a patient-facing one. RBAC first, then the caller's own token gates
// every downstream skill.
router.post('/ask', authenticate, authorizeRole('doctor'), agentController.ask);

// Inspect what the agent remembers for a session (the "recall" deliverable).
router.get('/sessions/:id', authenticate, authorizeRole('doctor'), agentController.getSession);

// The trace for one run: planner steps from here plus the tool steps executed
// inside healthcare-mcp, stitched by runId. Scoped to the doctor who asked.
router.get('/traces/:runId', authenticate, authorizeRole('doctor'), agentController.getTrace);

module.exports = router;
