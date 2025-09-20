const express = require('express');
const router = express.Router();
const { requireAuth } = require('@clerk/clerk-sdk-node');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// Get current user (patient or doctor)
router.get('/me', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    
    // First try to find as patient
    let user = await Patient.findOne({ clerkUserId: userId });
    let userType = 'patient';
    
    // If not found, try as doctor
    if (!user) {
      user = await Doctor.findOne({ clerkUserId: userId });
      userType = 'doctor';
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    
    res.json({
      ...user.toObject(),
      userType
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const updateData = req.body;
    
    // First try to find as patient
    let user = await Patient.findOne({ clerkUserId: userId });
    let userType = 'patient';
    
    // If not found, try as doctor
    if (!user) {
      user = await Doctor.findOne({ clerkUserId: userId });
      userType = 'doctor';
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    
    // Update the user
    Object.assign(user, updateData);
    await user.save();
    
    res.json({
      ...user.toObject(),
      userType
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
