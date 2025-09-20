const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
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
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  specialty: {
    type: String,
    required: true,
    default: 'General Physician'
  },
  experience: {
    type: Number,
    required: true,
    default: 0
  },
  qualifications: [{
    type: String
  }],
  consultationFee: {
    type: Number,
    required: true,
    default: 100
  },
  bio: {
    type: String,
    default: ''
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
  isVerified: {
    type: Boolean,
    default: false
  },
  availability: {
    monday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    tuesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    wednesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    thursday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    friday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    saturday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{ type: String }]
    },
    sunday: {
      isAvailable: { type: Boolean, default: false },
      slots: [{ type: String }]
    }
  },
  avatar: {
    type: String,
    default: function() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=10b981&color=fff&size=150`;
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', DoctorSchema);
