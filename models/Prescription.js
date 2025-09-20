const mongoose = require('mongoose');

const PrescriptionItemSchema = new mongoose.Schema({
  medicineId: {
    type: String,
    required: true
  },
  medicineName: {
    type: String,
    required: true
  },
  genericName: {
    type: String,
    required: true
  },
  dosage: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    required: true,
    enum: ['Once daily', 'Twice daily', 'Thrice daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed', 'Before meals', 'After meals', 'At bedtime']
  },
  duration: {
    type: Number,
    required: true // in days
  },
  instructions: {
    type: String,
    default: ''
  },
  totalQuantity: {
    type: Number,
    required: true
  }
});

const PrescriptionSchema = new mongoose.Schema({
  prescriptionId: {
    type: String,
    required: true,
    unique: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
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
  diagnosis: {
    type: String,
    required: true
  },
  symptoms: [String],
  medicines: [PrescriptionItemSchema],
  additionalNotes: {
    type: String,
    default: ''
  },
  followUpDate: {
    type: Date
  },
  followUpInstructions: {
    type: String,
    default: ''
  },
  totalCost: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  pdfPath: {
    type: String,
    default: ''
  },
  createdDuringCall: {
    type: Boolean,
    default: true
  },
  vitals: {
    bloodPressure: String,
    temperature: String,
    pulse: String,
    weight: String,
    height: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
PrescriptionSchema.index({ patientClerkId: 1, createdAt: -1 });
PrescriptionSchema.index({ doctorClerkId: 1, createdAt: -1 });
PrescriptionSchema.index({ prescriptionId: 1 });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
