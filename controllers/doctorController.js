const Doctor = require('../models/Doctor');
const { connectedUsers } = require('../services/socketService');

const getAllDoctors = async (req, res) => {
  try {
    const { specialty, search, sortBy = 'rating' } = req.query;
    
    let query = { isVerified: true };
    
    if (specialty && specialty !== 'all') {
      query.specialty = specialty;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }
    
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
      .select('-socketId -clerkUserId')
      .sort(sortOptions)
      .limit(50);
    
    const doctorsWithStatus = doctors.map(doctor => ({
      ...doctor.toObject(),
      isOnline: connectedUsers.has(doctor._id.toString()),
      avatar: doctor.getAvatarUrl()
    }));
    
    console.log(`📋 Returning ${doctors.length} doctors`);
    res.json(doctorsWithStatus);
  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .select('-socketId -clerkUserId');
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    res.json({
      ...doctor.toObject(),
      isOnline: connectedUsers.has(doctor._id.toString()),
      avatar: doctor.getAvatarUrl()
    });
  } catch (error) {
    console.error('❌ Error fetching doctor:', error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
};

const getSpecialties = (req, res) => {
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
  
  res.json(specialties);
};

const seedDoctors = async (req, res) => {
  try {
    const existingCount = await Doctor.countDocuments();
    if (existingCount > 0) {
      const doctors = await Doctor.find({ isVerified: true }).limit(20);
      return res.json({ message: 'Doctors already exist', doctors });
    }
    
    const sampleDoctors = [
      {
        clerkUserId: 'sample_doc_1',
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@hospital.com',
        phone: '+1234567890',
        specialty: 'General Physician',
        qualifications: [{ degree: 'MBBS', institution: 'Harvard Medical School', year: 2010 }],
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
        qualifications: [{ degree: 'MD', institution: 'Johns Hopkins', year: 2008 }],
        experience: 15,
        consultationFee: 300,
        bio: 'Specialized in heart diseases and cardiac procedures.',
        isVerified: true,
        licenseNumber: 'MD789012',
        rating: 4.9,
        totalReviews: 203
      },
      {
        clerkUserId: 'sample_doc_3',
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@dermatology.com',
        phone: '+1234567892',
        specialty: 'Dermatologist',
        qualifications: [{ degree: 'MD', institution: 'Stanford Medical School', year: 2012 }],
        experience: 10,
        consultationFee: 200,
        bio: 'Expert in skin conditions and cosmetic dermatology.',
        isVerified: true,
        licenseNumber: 'MD345678',
        rating: 4.7,
        totalReviews: 89
      }
    ];
    
    const doctors = await Doctor.insertMany(sampleDoctors);
    console.log('✅ Created sample doctors:', doctors.length);
    res.json({ message: 'Sample doctors created successfully', doctors });
  } catch (error) {
    console.error('❌ Error creating sample doctors:', error);
    res.status(500).json({ error: 'Failed to create sample doctors' });
  }
};

const updateDoctorProfile = async (req, res) => {
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
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getSpecialties,
  seedDoctors,
  updateDoctorProfile
};
