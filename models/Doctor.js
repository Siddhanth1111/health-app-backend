const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  specialty: {
    type: String,
    required: true,
    enum: [
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
    ]
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  experience: {
    type: Number,
    required: true, // years of experience
    min: 0
  },
  consultationFee: {
    type: Number,
    required: true,
    min: 0
  },
  bio: {
    type: String,
    maxlength: 500
  },
  avatar: {
    type: String,
    default: function() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=4f46e5&color=fff&size=150`;
    }
  },
  languages: [String],
  availability: {
    monday: { start: String, end: String, available: Boolean },
    tuesday: { start: String, end: String, available: Boolean },
    wednesday: { start: String, end: String, available: Boolean },
    thursday: { start: String, end: String, available: Boolean },
    friday: { start: String, end: String, available: Boolean },
    saturday: { start: String, end: String, available: Boolean },
    sunday: { start: String, end: String, available: Boolean }
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  socketId: String,
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  licenseNumber: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Virtual for avatar URL
doctorSchema.methods.getAvatarUrl = function() {
  return this.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=4f46e5&color=fff&size=150`;
};

// Index for efficient querying
doctorSchema.index({ specialty: 1, isOnline: 1 });
doctorSchema.index({ clerkUserId: 1 });
doctorSchema.index({ email: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
