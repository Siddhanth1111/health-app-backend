const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { bookConsultation, getConsultations } = require('../controllers/consultationController');

// Add logging middleware for debugging
router.use((req, res, next) => {
  console.log(`📋 Consultations route: ${req.method} ${req.path}`);
  next();
});

// Protected routes
router.get('/', requireAuth, getConsultations);
router.post('/', requireAuth, bookConsultation);

module.exports = router;
