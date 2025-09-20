const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  medicineId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  genericName: {
    type: String,
    required: true
  },
  brandName: {
    type: String,
    required: true
  },
  manufacturer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Antibiotic', 'Painkiller', 'Antacid', 'Antihistamine', 'Vitamin', 'Supplement', 'Cardiovascular', 'Diabetes', 'Blood Pressure', 'Respiratory', 'Digestive', 'Neurological', 'Dermatological', 'Other']
  },
  dosageForm: {
    type: String,
    required: true,
    enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Gel']
  },
  strength: {
    type: String,
    required: true
  },
  commonDosages: [{
    condition: String,
    dosage: String,
    frequency: String,
    duration: String
  }],
  sideEffects: [String],
  contraindications: [String],
  interactions: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    default: 0
  },
  searchKeywords: [String]
}, {
  timestamps: true
});

// Text search index
MedicineSchema.index({
  name: 'text',
  genericName: 'text',
  brandName: 'text',
  manufacturer: 'text',
  category: 'text'
});

module.exports = mongoose.model('Medicine', MedicineSchema);
