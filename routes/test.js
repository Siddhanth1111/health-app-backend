const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Test route
router.get('/', (req, res) => {
  res.json({ message: 'Test API is working!' });
});

// Get connected users (for debugging)
router.get('/connected-users', (req, res) => {
  try {
    // This would require access to socket service data
    res.json({ 
      message: 'Socket service running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test patient creation
router.post('/create-patient', async (req, res) => {
  try {
    const { clerkUserId, name, email } = req.body;
    
    if (!clerkUserId || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const patient = await Patient.create({
      clerkUserId,
      name,
      email,
      gender: 'prefer-not-to-say'
    });
    
    res.json({ success: true, patient });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Test doctor creation
router.post('/create-doctor', async (req, res) => {
  try {
    const { clerkUserId, name, email } = req.body;
    
    if (!clerkUserId || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const doctor = await Doctor.create({
      clerkUserId,
      name,
      email,
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
