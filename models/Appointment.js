const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  patientClerkId: {
    type: String,
    required: true
  },
  doctorClerkId: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  reason: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  consultationFee: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 30 // minutes
  },
  callStarted: {
    type: Boolean,
    default: false
  },
  callEndedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
AppointmentSchema.index({ patientClerkId: 1, appointmentDate: 1 });
AppointmentSchema.index({ doctorClerkId: 1, appointmentDate: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);
