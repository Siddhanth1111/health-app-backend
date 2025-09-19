const Patient = require('../models/Patient');

const updatePatientProfile = async (req, res) => {
  try {
    const { userId } = req.auth; // This is now the actual Clerk user ID
    const profileData = req.body;
    
    console.log('💾 === PATIENT PROFILE CREATION START ===');
    console.log('🔐 Clerk User ID:', userId);
    console.log('📝 Received profile data:', JSON.stringify(profileData, null, 2));
    
    // Validate required fields
    if (!profileData.name || !profileData.email) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: name and email are required' 
      });
    }
    
    const mergedData = {
      clerkUserId: userId, // Store the actual Clerk user ID
      name: profileData.name,
      email: profileData.email,
      phone: profileData.phone || '',
      dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : new Date('1990-01-01'),
      gender: profileData.gender || 'Other',
      bloodGroup: profileData.bloodGroup || ''
    };
    
    console.log('💾 Data to save in database:', JSON.stringify(mergedData, null, 2));
    
    // Check if patient already exists
    let existingPatient = await Patient.findOne({ clerkUserId: userId });
    console.log('🔍 Existing patient found:', !!existingPatient);
    
    let patient;
    if (existingPatient) {
      console.log('🔄 Updating existing patient...');
      patient = await Patient.findByIdAndUpdate(
        existingPatient._id,
        mergedData,
        { new: true, runValidators: true }
      );
    } else {
      console.log('➕ Creating new patient...');
      patient = new Patient(mergedData);
      await patient.save();
    }
    
    console.log('✅ Patient saved successfully:');
    console.log('   - Database ID:', patient._id);
    console.log('   - Name:', patient.name);
    console.log('   - Email:', patient.email);
    console.log('   - Clerk User ID:', patient.clerkUserId);
    console.log('💾 === PATIENT PROFILE CREATION END ===');
    
    res.json({
      success: true,
      message: 'Patient profile created/updated successfully',
      userType: 'patient',
      ...patient.toObject(),
      avatar: patient.getAvatarUrl()
    });
    
  } catch (error) {
    console.error('❌ === PATIENT PROFILE CREATION FAILED ===');
    console.error('❌ Error details:', error);
    console.error('❌ Error message:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to save patient profile',
      details: error.message
    });
  }
};

module.exports = {
  updatePatientProfile
};
