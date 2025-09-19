const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getCurrentUser } = require('../controllers/authController');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Get current user profile
router.get('/users/me', requireAuth, getCurrentUser);

// DEBUG ROUTE - Remove this after fixing
router.get('/debug/users/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    console.log('🔍 Debug: Looking for user with Clerk ID:', clerkUserId.substring(0, 30) + '...');
    
    // Search in both collections
    const patient = await Patient.findOne({ clerkUserId });
    const doctor = await Doctor.findOne({ clerkUserId });
    
    // Get all patients (limited) for comparison
    const allPatients = await Patient.find({}).limit(5).select('clerkUserId name email');
    const allDoctors = await Doctor.find({}).limit(5).select('clerkUserId name email');
    
    res.json({
      searchedFor: clerkUserId.substring(0, 30) + '...',
      found: {
        patient: patient ? {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          clerkUserId: patient.clerkUserId.substring(0, 30) + '...'
        } : null,
        doctor: doctor ? {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          clerkUserId: doctor.clerkUserId.substring(0, 30) + '...'
        } : null
      },
      totalPatientsInDB: await Patient.countDocuments(),
      totalDoctorsInDB: await Doctor.countDocuments(),
      samplePatients: allPatients.map(p => ({
        name: p.name,
        email: p.email,
        clerkUserId: p.clerkUserId.substring(0, 30) + '...'
      })),
      sampleDoctors: allDoctors.map(d => ({
        name: d.name,
        email: d.email,
        clerkUserId: d.clerkUserId.substring(0, 30) + '...'
      }))
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
