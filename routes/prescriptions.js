const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Search medicines
router.get('/medicines/search', async (req, res) => {
  try {
    const { query, category, limit = 10 } = req.query;
    
    let searchCriteria = { isActive: true };
    
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { genericName: { $regex: query, $options: 'i' } },
        { brandName: { $regex: query, $options: 'i' } },
        { searchKeywords: { $in: [new RegExp(query, 'i')] } }
      ];
    }
    
    if (category) {
      searchCriteria.category = category;
    }
    
    const medicines = await Medicine.find(searchCriteria)
      .limit(parseInt(limit))
      .sort({ name: 1 });
    
    console.log(`🔍 Found ${medicines.length} medicines for query: "${query}"`);
    res.json(medicines);
  } catch (error) {
    console.error('❌ Error searching medicines:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get medicine categories
router.get('/medicines/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category', { isActive: true });
    res.json(categories.sort());
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get medicine by ID
router.get('/medicines/:medicineId', async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ 
      medicineId: req.params.medicineId,
      isActive: true 
    });
    
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    
    res.json(medicine);
  } catch (error) {
    console.error('❌ Error fetching medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create prescription during video call
router.post('/create', async (req, res) => {
  try {
    const {
      appointmentId,
      patientClerkId,
      doctorClerkId,
      diagnosis,
      symptoms,
      medicines,
      additionalNotes,
      followUpDate,
      followUpInstructions,
      vitals
    } = req.body;

    // Validate required fields
    if (!appointmentId || !patientClerkId || !doctorClerkId || !diagnosis || !medicines?.length) {
      return res.status(400).json({ 
        error: 'Missing required fields: appointmentId, patientClerkId, doctorClerkId, diagnosis, medicines' 
      });
    }

    // Get patient and doctor info
    const patient = await Patient.findOne({ clerkUserId: patientClerkId });
    const doctor = await Doctor.findOne({ clerkUserId: doctorClerkId });

    if (!patient || !doctor) {
      return res.status(404).json({ error: 'Patient or Doctor not found' });
    }

    // Generate prescription ID
    const prescriptionId = `RX${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Calculate total cost
    let totalCost = 0;
    for (const item of medicines) {
      const medicine = await Medicine.findOne({ medicineId: item.medicineId });
      if (medicine) {
        totalCost += (medicine.price || 0) * (item.totalQuantity || 1);
      }
    }

    // Create prescription
    const prescription = new Prescription({
      prescriptionId,
      appointmentId,
      patientId: patient._id,
      doctorId: doctor._id,
      patientClerkId,
      doctorClerkId,
      diagnosis,
      symptoms: symptoms || [],
      medicines,
      additionalNotes: additionalNotes || '',
      followUpDate: followUpDate || null,
      followUpInstructions: followUpInstructions || '',
      totalCost,
      vitals: vitals || {},
      createdDuringCall: true
    });

    await prescription.save();

    // Generate PDF
    const pdfPath = await generatePrescriptionPDF(prescription, patient, doctor);
    prescription.pdfPath = pdfPath;
    await prescription.save();

    console.log('✅ Prescription created:', prescriptionId);
    res.json({
      success: true,
      prescriptionId,
      pdfPath,
      totalCost,
      message: 'Prescription created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating prescription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get patient prescriptions
router.get('/patient/:patientClerkId', async (req, res) => {
  try {
    const { patientClerkId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const prescriptions = await Prescription.find({ patientClerkId })
      .populate('doctorId', 'name specialty')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Prescription.countDocuments({ patientClerkId });

    res.json({
      prescriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching patient prescriptions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get prescription by ID
router.get('/:prescriptionId', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      prescriptionId: req.params.prescriptionId 
    })
    .populate('patientId', 'name email')
    .populate('doctorId', 'name specialty experience');

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json(prescription);
  } catch (error) {
    console.error('❌ Error fetching prescription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download prescription PDF
router.get('/:prescriptionId/pdf', async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      prescriptionId: req.params.prescriptionId 
    });

    if (!prescription || !prescription.pdfPath) {
      return res.status(404).json({ error: 'Prescription PDF not found' });
    }

    const pdfPath = path.join(__dirname, '..', prescription.pdfPath);
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="prescription_${prescription.prescriptionId}.pdf"`);
    
    const pdfStream = fs.createReadStream(pdfPath);
    pdfStream.pipe(res);

  } catch (error) {
    console.error('❌ Error downloading prescription PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate PDF function
async function generatePrescriptionPDF(prescription, patient, doctor) {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'prescriptions');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `prescription_${prescription.prescriptionId}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(fs.createWriteStream(filePath));

      // Header
      doc.fontSize(20).font('Helvetica-Bold')
         .text('MEDICAL PRESCRIPTION', { align: 'center' })
         .moveDown(0.5);

      // Doctor Information
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Dr. ' + doctor.name, { align: 'right' })
         .font('Helvetica')
         .text(doctor.specialty || 'General Physician', { align: 'right' })
         .text('Reg. No: DOC' + doctor._id.toString().slice(-6).toUpperCase(), { align: 'right' })
         .moveDown(1);

      // Patient Information
      doc.fontSize(14).font('Helvetica-Bold')
         .text('Patient Details:', 50, doc.y)
         .font('Helvetica')
         .fontSize(12)
         .text(`Name: ${patient.name}`, 50, doc.y + 20)
         .text(`Patient ID: ${patient._id.toString().slice(-8).toUpperCase()}`, 50, doc.y + 15)
         .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 50, doc.y + 15)
         .text(`Prescription ID: ${prescription.prescriptionId}`, 50, doc.y + 15)
         .moveDown(1);

      // Diagnosis
      if (prescription.diagnosis) {
        doc.fontSize(14).font('Helvetica-Bold')
           .text('Diagnosis:', 50, doc.y)
           .font('Helvetica')
           .fontSize(12)
           .text(prescription.diagnosis, 50, doc.y + 20)
           .moveDown(1);
      }

      // Symptoms
      if (prescription.symptoms && prescription.symptoms.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold')
           .text('Symptoms:', 50, doc.y)
           .font('Helvetica')
           .fontSize(12)
           .text(prescription.symptoms.join(', '), 50, doc.y + 20)
           .moveDown(1);
      }

      // Vitals
      if (prescription.vitals && Object.keys(prescription.vitals).length > 0) {
        doc.fontSize(14).font('Helvetica-Bold')
           .text('Vitals:', 50, doc.y)
           .font('Helvetica')
           .fontSize(12);

        let vitalsText = '';
        if (prescription.vitals.bloodPressure) vitalsText += `BP: ${prescription.vitals.bloodPressure}, `;
        if (prescription.vitals.temperature) vitalsText += `Temp: ${prescription.vitals.temperature}, `;
        if (prescription.vitals.pulse) vitalsText += `Pulse: ${prescription.vitals.pulse}, `;
        if (prescription.vitals.weight) vitalsText += `Weight: ${prescription.vitals.weight}`;
        
        doc.text(vitalsText, 50, doc.y + 20).moveDown(1);
      }

      // Medicines table header
      doc.fontSize(14).font('Helvetica-Bold')
         .text('Prescribed Medicines:', 50, doc.y)
         .moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      doc.fontSize(11).font('Helvetica-Bold')
         .text('Medicine', 50, tableTop)
         .text('Dosage', 200, tableTop)
         .text('Frequency', 300, tableTop)
         .text('Duration', 400, tableTop)
         .text('Qty', 480, tableTop);

      // Draw line under header
      doc.moveTo(50, tableTop + 15)
         .lineTo(530, tableTop + 15)
         .stroke();

      // Medicines list
      let currentY = tableTop + 25;
      doc.font('Helvetica').fontSize(10);

      prescription.medicines.forEach((medicine, index) => {
        if (currentY > 700) { // Start new page if needed
          doc.addPage();
          currentY = 50;
        }

        doc.text(medicine.medicineName, 50, currentY)
           .text(medicine.dosage, 200, currentY)
           .text(medicine.frequency, 300, currentY)
           .text(`${medicine.duration} days`, 400, currentY)
           .text(medicine.totalQuantity.toString(), 480, currentY);

        if (medicine.instructions) {
          currentY += 12;
          doc.fontSize(9).fillColor('gray')
             .text(`Instructions: ${medicine.instructions}`, 70, currentY)
             .fillColor('black').fontSize(10);
        }

        currentY += 20;
      });

      // Additional Notes
      if (prescription.additionalNotes) {
        currentY += 10;
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Additional Notes:', 50, currentY)
           .font('Helvetica')
           .fontSize(10)
           .text(prescription.additionalNotes, 50, currentY + 15, { width: 480 });
        currentY += 40;
      }

      // Follow-up
      if (prescription.followUpDate || prescription.followUpInstructions) {
        currentY += 10;
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Follow-up:', 50, currentY)
           .font('Helvetica')
           .fontSize(10);
        
        if (prescription.followUpDate) {
          doc.text(`Next visit: ${new Date(prescription.followUpDate).toLocaleDateString('en-IN')}`, 50, currentY + 15);
          currentY += 15;
        }
        
        if (prescription.followUpInstructions) {
          doc.text(`Instructions: ${prescription.followUpInstructions}`, 50, currentY + 15);
        }
      }

      // Footer
      doc.fontSize(8).fillColor('gray')
         .text('This is a digitally generated prescription.', 50, 750, { align: 'center' })
         .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, 765, { align: 'center' });

      // Finalize PDF
      doc.end();

      doc.on('end', () => {
        const relativePath = `uploads/prescriptions/${fileName}`;
        resolve(relativePath);
      });

      doc.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = router;
