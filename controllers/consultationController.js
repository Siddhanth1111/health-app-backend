const Consultation = require('../models/Consultation');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

const bookConsultation = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { doctorId, scheduledAt, symptoms, type = 'video' } = req.body;
    
    console.log('📅 Booking consultation for user:', userId.substring(0, 20) + '...');
    
    const patient = await Patient.findOne({ clerkUserId: userId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found. Please complete your profile first.' });
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    const consultation = new Consultation({
      patient: patient._id,
      doctor: doctor._id,
      scheduledAt,
      symptoms,
      type,
      fee: doctor.consultationFee
    });
    
    await consultation.save();
    await consultation.populate(['patient', 'doctor']);
    
    console.log('✅ Consultation booked successfully');
    res.json(consultation);
  } catch (error) {
    console.error('❌ Error booking consultation:', error);
    res.status(500).json({ error: 'Failed to book consultation' });
  }
};

const getConsultations = async (req, res) => {
  try {
    const { userId } = req.auth;
    console.log('📋 Getting consultations for user:', userId.substring(0, 20) + '...');
    
    // Try to find user as patient first
    let user = await Patient.findOne({ clerkUserId: userId });
    let query = {};
    let userType = 'patient';
    
    if (user) {
      query.patient = user._id;
      console.log('👤 Found patient:', user.name);
    } else {
      // Try as doctor
      user = await Doctor.findOne({ clerkUserId: userId });
      if (user) {
        query.doctor = user._id;
        userType = 'doctor';
        console.log('👨‍⚕️ Found doctor:', user.name);
      } else {
        console.log('❌ No profile found for user');
        // Return empty array instead of error for better UX
        return res.json([]);
      }
    }
    
    const consultations = await Consultation.find(query)
      .populate(['patient', 'doctor'])
      .sort({ scheduledAt: -1 })
      .limit(50);
    
    console.log(`📋 Found ${consultations.length} consultations`);
    res.json(consultations);
  } catch (error) {
    console.error('❌ Error fetching consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

module.exports = {
  bookConsultation,
  getConsultations
};
