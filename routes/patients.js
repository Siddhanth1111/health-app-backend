const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { updatePatientProfile } = require('../controllers/patientController');

// Protected routes
router.post('/profile', requireAuth, updatePatientProfile);

module.exports = router;
