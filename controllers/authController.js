const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const getCurrentUser = async (req, res) => {
  try {
    const { userId, token } = req.auth;
    console.log('👤 === GETTING USER PROFILE START ===');
    console.log('🔐 Decoded userId:', userId);
    console.log('🎫 Original token:', token.substring(0, 30) + '...');
    
    // Search for patient with detailed logging
    console.log('🔍 Searching for patient...');
    let user = await Patient.findOne({ clerkUserId: userId });
    console.log('📊 Patient search result:', user ? `Found: ${user.name}` : 'Not found');
    
    if (!user) {
      console.log('🔍 Searching by original token...');
      user = await Patient.findOne({ clerkUserId: token });
      console.log('📊 Token search result:', user ? `Found: ${user.name}` : 'Not found');
    }
    
    let userType = null;
    
    if (user) {
      userType = 'patient';
      console.log('✅ Found patient:', user.name, 'ID:', user._id);
      
      // If found by token, update the record to use proper userId
      if (user.clerkUserId === token && token !== userId) {
        console.log('🔄 Migrating clerkUserId from token to actual user ID...');
        user.clerkUserId = userId;
        await user.save();
        console.log('✅ Migration completed');
      }
    } else {
      // If not patient, try doctor
      console.log('🔍 Searching for doctor...');
      user = await Doctor.findOne({ clerkUserId: userId });
      console.log('📊 Doctor search result:', user ? `Found: ${user.name}` : 'Not found');
      
      if (!user) {
        console.log('🔍 Searching doctor by original token...');
        user = await Doctor.findOne({ clerkUserId: token });
        console.log('📊 Doctor token search result:', user ? `Found: ${user.name}` : 'Not found');
      }
      
      if (user) {
        userType = 'doctor';
        console.log('✅ Found doctor:', user.name, 'ID:', user._id);
        
        // Migrate if needed
        if (user.clerkUserId === token && token !== userId) {
          console.log('🔄 Migrating doctor clerkUserId...');
          user.clerkUserId = userId;
          await user.save();
        }
      }
    }
    
    if (!user) {
      console.log('❌ No profile found anywhere');
      console.log('🔍 Let me check all patients in database...');
      
      // Debug: Check all patients
      const allPatients = await Patient.find({}).select('clerkUserId name email');
      console.log('📋 All patients in database:');
      allPatients.forEach(p => {
        console.log(`   - ${p.name}: ${p.clerkUserId}`);
        console.log(`     Matches userId? ${p.clerkUserId === userId}`);
        console.log(`     Matches token? ${p.clerkUserId === token}`);
      });
      
      return res.json({
        clerkUserId: userId,
        name: 'New User',
        email: 'user@example.com',
        userType: null,
        needsOnboarding: true,
        message: 'Profile not found. Please complete onboarding.',
        debug: {
          searchedUserId: userId,
          searchedToken: token.substring(0, 30) + '...',
          totalPatientsInDB: allPatients.length
        }
      });
    }
    
    // User found - return complete profile
    console.log(`✅ Returning ${userType} profile:`, user.name);
    console.log('👤 === GETTING USER PROFILE END ===');
    
    const response = {
      ...user.toObject(),
      userType,
      avatar: user.getAvatarUrl(),
      isOnline: false,
      needsOnboarding: false,
      message: `${userType} profile loaded successfully`
    };
    
    console.log('📤 Response userType:', response.userType);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

module.exports = {
  getCurrentUser
};
