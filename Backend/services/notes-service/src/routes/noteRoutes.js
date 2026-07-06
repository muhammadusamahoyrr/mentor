const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { validate } = require('../middleware/validate');
const { createNoteSchema, updateNoteSchema } = require('../validation/noteSchema');

// Full CRUD for the Note resource.
router.post('/', validate(createNoteSchema), noteController.createNote);
router.get('/', noteController.getNotes);
router.get('/:id', noteController.getNoteById);
router.put('/:id', validate(updateNoteSchema), noteController.updateNote);
router.delete('/:id', noteController.deleteNote);

module.exports = router;
