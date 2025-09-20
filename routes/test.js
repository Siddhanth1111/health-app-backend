const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Test route
router.get('/', (req, res) => {
  res.json({ message: 'Medical consultation API is working!' });
});

// Test patient creation
router.post('/create-test-patient', async (req, res) => {
  try {
    const patient = await Patient.create({
      clerkUserId: 'test_patient_123',
      name: 'Test Patient',
      email: 'test@patient.com',
      gender: 'prefer-not-to-say'
    });
    res.json({ success: true, patient });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Test doctor creation
router.post('/create-test-doctor', async (req, res) => {
  try {
    const doctor = await Doctor.create({
      clerkUserId: 'test_doctor_123',
      name: 'Test Doctor',
      email: 'test@doctor.com',
      specialty: 'General Physician',
      experience: 5,
      consultationFee: 100,
      isVerified: true
    });
    res.json({ success: true, doctor });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
