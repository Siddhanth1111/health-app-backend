const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['video', 'audio', 'chat'],
    default: 'video'
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  symptoms: [String],
  diagnosis: String,
  prescription: [{
    medication: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String
  }],
  notes: String,
  fee: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String,
  callStartedAt: Date,
  callEndedAt: Date
}, {
  timestamps: true
});

// Index for efficient querying
consultationSchema.index({ patient: 1, createdAt: -1 });
consultationSchema.index({ doctor: 1, scheduledAt: 1 });
consultationSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);
