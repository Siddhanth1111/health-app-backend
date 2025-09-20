const express = require('express');
const router = express.Router();
const { requireAuth } = require('@clerk/clerk-sdk-node');
const Patient = require('../models/Patient');

// Get all patients (for admin/doctors)
router.get('/', async (req, res) => {
  try {
    const patients = await Patient.find()
      .select('-__v')
      .sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get patient by ID
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create patient
router.post('/', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update patient
router.put('/:id', requireAuth(), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete patient
router.delete('/:id', requireAuth(), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
