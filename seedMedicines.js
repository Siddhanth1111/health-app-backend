const mongoose = require('mongoose');
const Medicine = require('./models/Medicine');

const dummyMedicines = [
  // Antibiotics
  {
    medicineId: 'MED001',
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    brandName: 'Amoxil',
    manufacturer: 'GSK',
    category: 'Antibiotic',
    dosageForm: 'Capsule',
    strength: '500mg',
    commonDosages: [
      { condition: 'Bacterial Infection', dosage: '500mg', frequency: 'Thrice daily', duration: '7 days' },
      { condition: 'Respiratory Infection', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' }
    ],
    sideEffects: ['Nausea', 'Diarrhea', 'Rash'],
    contraindications: ['Penicillin allergy'],
    price: 120,
    searchKeywords: ['antibiotic', 'infection', 'amoxil']
  },
  {
    medicineId: 'MED002',
    name: 'Azithromycin 250mg',
    genericName: 'Azithromycin',
    brandName: 'Zithromax',
    manufacturer: 'Pfizer',
    category: 'Antibiotic',
    dosageForm: 'Tablet',
    strength: '250mg',
    commonDosages: [
      { condition: 'Respiratory Infection', dosage: '500mg', frequency: 'Once daily', duration: '3 days' },
      { condition: 'Skin Infection', dosage: '250mg', frequency: 'Once daily', duration: '5 days' }
    ],
    sideEffects: ['Stomach upset', 'Diarrhea'],
    contraindications: ['Liver disease'],
    price: 85,
    searchKeywords: ['antibiotic', 'zithromax', 'respiratory']
  },

  // Painkillers
  {
    medicineId: 'MED003',
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    brandName: 'Crocin',
    manufacturer: 'GSK',
    category: 'Painkiller',
    dosageForm: 'Tablet',
    strength: '500mg',
    commonDosages: [
      { condition: 'Fever', dosage: '500mg', frequency: 'Every 6 hours', duration: '3 days' },
      { condition: 'Headache', dosage: '500mg', frequency: 'Twice daily', duration: '2 days' }
    ],
    sideEffects: ['Rare allergic reactions'],
    contraindications: ['Liver disease', 'Alcohol dependency'],
    price: 25,
    searchKeywords: ['painkiller', 'fever', 'headache', 'crocin']
  },
  {
    medicineId: 'MED004',
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    brandName: 'Brufen',
    manufacturer: 'Abbott',
    category: 'Painkiller',
    dosageForm: 'Tablet',
    strength: '400mg',
    commonDosages: [
      { condition: 'Pain & Inflammation', dosage: '400mg', frequency: 'Twice daily', duration: '5 days' },
      { condition: 'Fever', dosage: '400mg', frequency: 'Every 8 hours', duration: '3 days' }
    ],
    sideEffects: ['Stomach irritation', 'Dizziness'],
    contraindications: ['Stomach ulcers', 'Kidney disease'],
    price: 45,
    searchKeywords: ['painkiller', 'inflammation', 'brufen']
  },

  // Antacids
  {
    medicineId: 'MED005',
    name: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    brandName: 'Prilosec',
    manufacturer: 'AstraZeneca',
    category: 'Antacid',
    dosageForm: 'Capsule',
    strength: '20mg',
    commonDosages: [
      { condition: 'Acid Reflux', dosage: '20mg', frequency: 'Once daily', duration: '14 days' },
      { condition: 'Stomach Ulcer', dosage: '20mg', frequency: 'Twice daily', duration: '28 days' }
    ],
    sideEffects: ['Headache', 'Nausea'],
    contraindications: ['Liver disease'],
    price: 150,
    searchKeywords: ['antacid', 'acidity', 'ulcer', 'prilosec']
  },
  {
    medicineId: 'MED006',
    name: 'Ranitidine 150mg',
    genericName: 'Ranitidine',
    brandName: 'Zantac',
    manufacturer: 'GSK',
    category: 'Antacid',
    dosageForm: 'Tablet',
    strength: '150mg',
    commonDosages: [
      { condition: 'Heartburn', dosage: '150mg', frequency: 'Twice daily', duration: '7 days' },
      { condition: 'Acid Reflux', dosage: '150mg', frequency: 'Once daily', duration: '14 days' }
    ],
    sideEffects: ['Drowsiness', 'Headache'],
    contraindications: ['Kidney disease'],
    price: 60,
    searchKeywords: ['antacid', 'heartburn', 'zantac']
  },

  // Antihistamines
  {
    medicineId: 'MED007',
    name: 'Cetirizine 10mg',
    genericName: 'Cetirizine',
    brandName: 'Zyrtec',
    manufacturer: 'Johnson & Johnson',
    category: 'Antihistamine',
    dosageForm: 'Tablet',
    strength: '10mg',
    commonDosages: [
      { condition: 'Allergies', dosage: '10mg', frequency: 'Once daily', duration: '7 days' },
      { condition: 'Skin Rash', dosage: '10mg', frequency: 'Once daily', duration: '5 days' }
    ],
    sideEffects: ['Drowsiness', 'Dry mouth'],
    contraindications: ['Kidney disease'],
    price: 35,
    searchKeywords: ['allergy', 'antihistamine', 'rash', 'zyrtec']
  },
  {
    medicineId: 'MED008',
    name: 'Loratadine 10mg',
    genericName: 'Loratadine',
    brandName: 'Claritin',
    manufacturer: 'Bayer',
    category: 'Antihistamine',
    dosageForm: 'Tablet',
    strength: '10mg',
    commonDosages: [
      { condition: 'Seasonal Allergies', dosage: '10mg', frequency: 'Once daily', duration: '14 days' },
      { condition: 'Hives', dosage: '10mg', frequency: 'Once daily', duration: '7 days' }
    ],
    sideEffects: ['Headache', 'Fatigue'],
    contraindications: ['Liver disease'],
    price: 55,
    searchKeywords: ['allergy', 'seasonal', 'claritin']
  },

  // Vitamins & Supplements
  {
    medicineId: 'MED009',
    name: 'Vitamin D3 1000 IU',
    genericName: 'Cholecalciferol',
    brandName: 'D-Rise',
    manufacturer: 'Sun Pharma',
    category: 'Vitamin',
    dosageForm: 'Tablet',
    strength: '1000 IU',
    commonDosages: [
      { condition: 'Vitamin D Deficiency', dosage: '1000 IU', frequency: 'Once daily', duration: '30 days' },
      { condition: 'Bone Health', dosage: '1000 IU', frequency: 'Once daily', duration: '90 days' }
    ],
    sideEffects: ['Rare: Nausea if overdosed'],
    contraindications: ['Hypercalcemia'],
    price: 200,
    searchKeywords: ['vitamin', 'vitamin d', 'bone health', 'd-rise']
  },
  {
    medicineId: 'MED010',
    name: 'Multivitamin Complex',
    genericName: 'Multivitamin',
    brandName: 'Revital',
    manufacturer: 'Ranbaxy',
    category: 'Supplement',
    dosageForm: 'Capsule',
    strength: 'Multi',
    commonDosages: [
      { condition: 'General Health', dosage: '1 capsule', frequency: 'Once daily', duration: '30 days' },
      { condition: 'Nutritional Support', dosage: '1 capsule', frequency: 'Once daily', duration: '60 days' }
    ],
    sideEffects: ['Stomach upset if taken empty stomach'],
    contraindications: ['None known'],
    price: 350,
    searchKeywords: ['multivitamin', 'supplement', 'revital']
  },

  // Cardiovascular
  {
    medicineId: 'MED011',
    name: 'Atorvastatin 20mg',
    genericName: 'Atorvastatin',
    brandName: 'Lipitor',
    manufacturer: 'Pfizer',
    category: 'Cardiovascular',
    dosageForm: 'Tablet',
    strength: '20mg',
    commonDosages: [
      { condition: 'High Cholesterol', dosage: '20mg', frequency: 'Once daily', duration: '30 days' },
      { condition: 'Heart Disease Prevention', dosage: '20mg', frequency: 'Once daily', duration: '90 days' }
    ],
    sideEffects: ['Muscle pain', 'Liver enzyme elevation'],
    contraindications: ['Liver disease', 'Pregnancy'],
    price: 180,
    searchKeywords: ['cholesterol', 'heart', 'lipitor', 'statin']
  },
  {
    medicineId: 'MED012',
    name: 'Metoprolol 50mg',
    genericName: 'Metoprolol',
    brandName: 'Lopressor',
    manufacturer: 'Novartis',
    category: 'Blood Pressure',
    dosageForm: 'Tablet',
    strength: '50mg',
    commonDosages: [
      { condition: 'High Blood Pressure', dosage: '50mg', frequency: 'Twice daily', duration: '30 days' },
      { condition: 'Heart Rate Control', dosage: '25mg', frequency: 'Twice daily', duration: '30 days' }
    ],
    sideEffects: ['Dizziness', 'Fatigue', 'Cold hands'],
    contraindications: ['Asthma', 'Heart block'],
    price: 95,
    searchKeywords: ['blood pressure', 'heart rate', 'lopressor', 'beta blocker']
  },

  // Diabetes
  {
    medicineId: 'MED013',
    name: 'Metformin 500mg',
    genericName: 'Metformin',
    brandName: 'Glucophage',
    manufacturer: 'Bristol Myers',
    category: 'Diabetes',
    dosageForm: 'Tablet',
    strength: '500mg',
    commonDosages: [
      { condition: 'Type 2 Diabetes', dosage: '500mg', frequency: 'Twice daily', duration: '30 days' },
      { condition: 'Pre-diabetes', dosage: '500mg', frequency: 'Once daily', duration: '30 days' }
    ],
    sideEffects: ['Nausea', 'Diarrhea', 'Metallic taste'],
    contraindications: ['Kidney disease', 'Liver disease'],
    price: 75,
    searchKeywords: ['diabetes', 'blood sugar', 'glucophage', 'metformin']
  },

  // Respiratory
  {
    medicineId: 'MED014',
    name: 'Salbutamol Inhaler',
    genericName: 'Salbutamol',
    brandName: 'Ventolin',
    manufacturer: 'GSK',
    category: 'Respiratory',
    dosageForm: 'Inhaler',
    strength: '100mcg/puff',
    commonDosages: [
      { condition: 'Asthma', dosage: '2 puffs', frequency: 'As needed', duration: '30 days' },
      { condition: 'COPD', dosage: '2 puffs', frequency: 'Every 6 hours', duration: '30 days' }
    ],
    sideEffects: ['Tremor', 'Rapid heartbeat'],
    contraindications: ['Hypersensitivity'],
    price: 250,
    searchKeywords: ['asthma', 'inhaler', 'breathing', 'ventolin']
  },
  {
    medicineId: 'MED015',
    name: 'Dextromethorphan Syrup',
    genericName: 'Dextromethorphan',
    brandName: 'Robitussin DM',
    manufacturer: 'Pfizer',
    category: 'Respiratory',
    dosageForm: 'Syrup',
    strength: '15mg/5ml',
    commonDosages: [
      { condition: 'Dry Cough', dosage: '10ml', frequency: 'Every 6 hours', duration: '5 days' },
      { condition: 'Cold & Cough', dosage: '5ml', frequency: 'Every 4 hours', duration: '7 days' }
    ],
    sideEffects: ['Drowsiness', 'Dizziness'],
    contraindications: ['MAO inhibitor use'],
    price: 85,
    searchKeywords: ['cough', 'syrup', 'cold', 'robitussin']
  }
];

async function seedMedicines() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-consultation');
    console.log('Connected to MongoDB');

    // Clear existing medicines
    await Medicine.deleteMany({});
    console.log('Cleared existing medicines');

    // Insert dummy medicines
    await Medicine.insertMany(dummyMedicines);
    console.log(`✅ Successfully seeded ${dummyMedicines.length} medicines`);

    // Create text search index
    await Medicine.collection.createIndex({
      name: 'text',
      genericName: 'text',
      brandName: 'text',
      manufacturer: 'text',
      category: 'text'
    });
    console.log('✅ Created text search index');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error seeding medicines:', error);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedMedicines();
}

module.exports = { seedMedicines, dummyMedicines };
