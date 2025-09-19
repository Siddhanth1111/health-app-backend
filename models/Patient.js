const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
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
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  medicalHistory: [{
    condition: String,
    diagnosedDate: Date,
    notes: String
  }],
  allergies: [String],
  currentMedications: [String],
  avatar: {
    type: String,
    default: function() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=10b981&color=fff&size=150`;
    }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  height: Number, // in cm
  weight: Number, // in kg
  isOnline: {
    type: Boolean,
    default: false
  },
  socketId: String,
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for avatar URL
patientSchema.methods.getAvatarUrl = function() {
  return this.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=10b981&color=fff&size=150`;
};

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Index for efficient querying
patientSchema.index({ clerkUserId: 1 });
patientSchema.index({ email: 1 });

module.exports = mongoose.model('Patient', patientSchema);
