const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Doctor = require('../models/Doctor');

// Add logging middleware for debugging
router.use((req, res, next) => {
  console.log(`👨‍⚕️ Doctors route: ${req.method} ${req.path}`);
  next();
});

// Get all doctors (public route)
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching doctors...');
    
    const { specialty, search, sortBy = 'rating' } = req.query;
    console.log('🔍 Query params:', { specialty, search, sortBy });
    
    let query = {}; // Remove isVerified filter temporarily to see all doctors
    
    // Filter by specialty
    if (specialty && specialty !== 'all') {
      query.specialty = specialty;
    }
    
    // Search by name or specialty
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('🔍 Database query:', query);
    
    // Sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'rating':
        sortOptions = { rating: -1, totalReviews: -1 };
        break;
      case 'experience':
        sortOptions = { experience: -1 };
        break;
      case 'fee':
        sortOptions = { consultationFee: 1 };
        break;
      case 'name':
        sortOptions = { name: 1 };
        break;
      default:
        sortOptions = { rating: -1 };
    }
    
    const doctors = await Doctor.find(query)
      .sort(sortOptions)
      .limit(50);
    
    console.log(`📋 Found ${doctors.length} doctors in database`);
    
    if (doctors.length > 0) {
      console.log('👨‍⚕️ First doctor:', {
        name: doctors[0].name,
        specialty: doctors[0].specialty,
        isVerified: doctors[0].isVerified
      });
    }
    
    const doctorsWithStatus = doctors.map(doctor => ({
      ...doctor.toObject(),
      isOnline: false, // Will be updated by socket service later
      avatar: doctor.getAvatarUrl()
    }));
    
    console.log(`📋 Returning ${doctorsWithStatus.length} doctors to frontend`);
    res.json(doctorsWithStatus);
  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Get doctor specialties
router.get('/specialties', (req, res) => {
  const specialties = [
    'General Physician',
    'Cardiologist',
    'Dermatologist',
    'Pediatrician',
    'Orthopedic',
    'Gastroenterologist',
    'Neurologist',
    'Psychiatrist',
    'Gynecologist',
    'ENT Specialist',
    'Ophthalmologist',
    'Urologist'
  ];
  
  console.log('📋 Returning specialties:', specialties.length);
  res.json(specialties);
});

// Debug route to check all doctors
router.get('/debug/all', async (req, res) => {
  try {
    const doctors = await Doctor.find({});
    res.json({
      total: doctors.length,
      doctors: doctors.map(d => ({
        id: d._id,
        name: d.name,
        specialty: d.specialty,
        isVerified: d.isVerified,
        email: d.email,
        clerkUserId: d.clerkUserId ? d.clerkUserId.substring(0, 20) + '...' : 'No clerkUserId'
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Seed doctors (public route)
router.post('/seed', async (req, res) => {
  try {
    const existingCount = await Doctor.countDocuments();
    if (existingCount > 0) {
      const doctors = await Doctor.find({}).limit(20);
      return res.json({ 
        message: 'Doctors already exist', 
        count: doctors.length,
        doctors 
      });
    }
    
    const sampleDoctors = [
      {
        clerkUserId: 'sample_doc_1',
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@hospital.com',
        phone: '+1234567890',
        specialty: 'General Physician',
        qualifications: [{ 
          degree: 'MBBS', 
          institution: 'Harvard Medical School', 
          year: 2010 
        }],
        experience: 12,
        consultationFee: 150,
        bio: 'Experienced general physician with over 12 years of practice.',
        isVerified: true,
        licenseNumber: 'MD123456',
        rating: 4.8,
        totalReviews: 156
      },
      {
        clerkUserId: 'sample_doc_2',
        name: 'Dr. Michael Chen',
        email: 'michael.chen@cardiology.com',
        phone: '+1234567891',
        specialty: 'Cardiologist',
        qualifications: [{ 
          degree: 'MD', 
          institution: 'Johns Hopkins', 
          year: 2008 
        }],
        experience: 15,
        consultationFee: 300,
        bio: 'Specialized in heart diseases and cardiac procedures.',
        isVerified: true,
        licenseNumber: 'MD789012',
        rating: 4.9,
        totalReviews: 203
      }
    ];
    
    const doctors = await Doctor.insertMany(sampleDoctors);
    console.log('✅ Created sample doctors:', doctors.length);
    res.json({ 
      message: 'Sample doctors created successfully', 
      count: doctors.length,
      doctors 
    });
  } catch (error) {
    console.error('❌ Error creating sample doctors:', error);
    res.status(500).json({ error: 'Failed to create sample doctors' });
  }
});

// Protected routes
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json({
      ...doctor.toObject(),
      isOnline: false,
      avatar: doctor.getAvatarUrl()
    });
  } catch (error) {
    console.error('❌ Error fetching doctor:', error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// Update doctor profile
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { userId } = req.auth;
    const profileData = req.body;
    
    console.log('💾 Creating doctor profile for:', userId.substring(0, 20) + '...');
    console.log('📝 Profile data:', profileData);
    
    const mergedData = {
      ...profileData,
      clerkUserId: userId
    };
    
    const doctor = await Doctor.findOneAndUpdate(
      { clerkUserId: userId },
      mergedData,
      { upsert: true, new: true }
    );
    
    console.log('✅ Doctor profile created/updated:', doctor.name);
    
    res.json({
      ...doctor.toObject(),
      userType: 'doctor',
      avatar: doctor.getAvatarUrl()
    });
  } catch (error) {
    console.error('❌ Error creating/updating doctor profile:', error);
    res.status(500).json({ error: 'Failed to save doctor profile' });
  }
});

module.exports = router;
