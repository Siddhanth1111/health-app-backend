const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Existing routes...

// Add this new route to fix JWT-stored clerkUserIds
router.post('/fix-clerk-ids', async (req, res) => {
  try {
    console.log('🔧 Starting Clerk ID migration...');
    
    const decodeJwt = (token) => {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.sub || payload.user_id || payload.id;
      } catch (error) {
        return null;
      }
    };
    
    // Find all patients with JWT tokens as clerkUserId
    const patients = await Patient.find({
      clerkUserId: { $regex: /^eyJ/ } // JWT tokens start with 'eyJ'
    });
    
    const doctors = await Doctor.find({
      clerkUserId: { $regex: /^eyJ/ }
    });
    
    console.log(`Found ${patients.length} patients and ${doctors.length} doctors with JWT clerkUserIds`);
    
    let patientsFixed = 0;
    let doctorsFixed = 0;
    
    // Fix patients
    for (const patient of patients) {
      const actualUserId = decodeJwt(patient.clerkUserId);
      if (actualUserId) {
        await Patient.findByIdAndUpdate(patient._id, {
          clerkUserId: actualUserId
        });
        patientsFixed++;
        console.log(`✅ Fixed patient ${patient.name}: ${actualUserId}`);
      }
    }
    
    // Fix doctors
    for (const doctor of doctors) {
      const actualUserId = decodeJwt(doctor.clerkUserId);
      if (actualUserId) {
        await Doctor.findByIdAndUpdate(doctor._id, {
          clerkUserId: actualUserId
        });
        doctorsFixed++;
        console.log(`✅ Fixed doctor ${doctor.name}: ${actualUserId}`);
      }
    }
    
    res.json({
      success: true,
      message: 'Clerk ID migration completed',
      patientsFixed,
      doctorsFixed,
      totalFixed: patientsFixed + doctorsFixed
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test database connection and operations
router.post('/create-test-patient', async (req, res) => {
  try {
    console.log('🧪 Creating test patient...');
    
    const testPatient = new Patient({
      clerkUserId: 'test_clerk_id_' + Date.now(),
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Male'
    });
    
    const saved = await testPatient.save();
    console.log('✅ Test patient saved:', saved._id);
    
    res.json({
      success: true,
      message: 'Test patient created successfully',
      patient: saved
    });
  } catch (error) {
    console.error('❌ Error creating test patient:', error);
    res.json({
      success: false,
      error: error.message,
      details: error
    });
  }
});

// Get all patients in database
router.get('/all-patients', async (req, res) => {
  try {
    const patients = await Patient.find({});
    const doctors = await Doctor.find({});
    
    res.json({
      patients: patients.length,
      doctors: doctors.length,
      patientList: patients.map(p => ({
        id: p._id,
        name: p.name,
        email: p.email,
        clerkUserId: p.clerkUserId.length > 50 ? p.clerkUserId.substring(0, 30) + '...' : p.clerkUserId
      })),
      doctorList: doctors.map(d => ({
        id: d._id,
        name: d.name,
        email: d.email,
        clerkUserId: d.clerkUserId.length > 50 ? d.clerkUserId.substring(0, 30) + '...' : d.clerkUserId
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Add this route to check your specific user
router.get('/check-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🔍 Checking user:', userId);
    
    // Search in patients
    const patient = await Patient.findOne({ clerkUserId: userId });
    const patientByToken = await Patient.findOne({ 
      clerkUserId: { $regex: new RegExp(userId.substring(0, 20), 'i') } 
    });
    
    // Search in doctors  
    const doctor = await Doctor.findOne({ clerkUserId: userId });
    
    // Get all patients for comparison
    const allPatients = await Patient.find({}).select('clerkUserId name email');
    
    res.json({
      searchedFor: userId,
      results: {
        exactPatientMatch: patient ? {
          id: patient._id,
          name: patient.name,
          email: patient.email,
          clerkUserId: patient.clerkUserId
        } : null,
        partialPatientMatch: patientByToken ? {
          id: patientByToken._id,
          name: patientByToken.name,
          email: patientByToken.email,
          clerkUserId: patientByToken.clerkUserId
        } : null,
        doctorMatch: doctor ? {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          clerkUserId: doctor.clerkUserId
        } : null
      },
      allPatients: allPatients.map(p => ({
        name: p.name,
        email: p.email,
        clerkUserId: p.clerkUserId,
        matches: p.clerkUserId === userId
      })),
      totalPatients: allPatients.length
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});


module.exports = router;
