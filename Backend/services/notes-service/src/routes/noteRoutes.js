const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { createNoteSchema, updateNoteSchema } = require('../validation/noteSchema');

// Notes are clinical records — every route needs an identified caller.
router.use(authenticate);

// Full CRUD for the Note resource.
router.post('/', validate(createNoteSchema), noteController.createNote);
router.get('/', noteController.getNotes);
router.get('/:id', noteController.getNoteById);
router.put('/:id', validate(updateNoteSchema), noteController.updateNote);

// A doctor signs off an AI-drafted note. Doctor-only; the access check in the
// controller still applies so a doctor can only confirm notes they can see.
router.post('/:id/confirm', authorizeRole('doctor'), noteController.confirmNote);

// Role-based rule: a clinical record may be written by either party on the
// consultation, but only a doctor may destroy one. A patient cannot delete a
// note even if they wrote it themselves — the author check in the controller
// still applies on top, so a doctor can only delete their own.
router.delete('/:id', authorizeRole('doctor'), noteController.deleteNote);

module.exports = router;
