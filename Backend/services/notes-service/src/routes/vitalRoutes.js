const express = require('express');
const router = express.Router();
const vitalController = require('../controllers/vitalController');
const { authenticate, authorizeRole } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { createVitalSchema } = require('../validation/vitalSchema');

router.use(authenticate);

// Role-based rule: vitals are self-reported, so only a patient may record one.
// A doctor has no "own vitals" in this system.
router.post('/', authorizeRole('patient'), validate(createVitalSchema), vitalController.createVital);

// Scoped to the caller by the controller — there is no patientId parameter to
// tamper with.
router.get('/', vitalController.getVitals);
router.delete('/:id', vitalController.deleteVital);

module.exports = router;
