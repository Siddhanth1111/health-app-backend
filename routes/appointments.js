const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { 
  generateTimeSlots,
  getAvailableSlots,
  getFormattedTimeSlots,
  getGroupedTimeSlots,
  validateAppointmentTime,
  isWithinOperatingHours
} = require('../utils/timeSlots');

// Get all available time slots
router.get('/time-slots', (req, res) => {
  try {
    const { grouped = false, formatted = false } = req.query;
    
    if (grouped === 'true') {
      const groupedSlots = getGroupedTimeSlots();
      res.json(groupedSlots);
    } else if (formatted === 'true') {
      const formattedSlots = getFormattedTimeSlots();
      res.json(formattedSlots);
    } else {
      const basicSlots = generateTimeSlots();
      res.json(basicSlots);
    }
  } catch (error) {
    console.error('❌ Error fetching time slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available slots for a specific doctor and date
router.get('/available-slots/:doctorClerkId', async (req, res) => {
  try {
    const { doctorClerkId } = req.params;
    const { date, duration = 30 } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    const appointmentDate = new Date(date);
    const availableSlots = await getAvailableSlots(doctorClerkId, appointmentDate, parseInt(duration));
    
    // Format the available slots
    const formattedSlots = getFormattedTimeSlots().filter(slot => 
      availableSlots.includes(slot.value)
    );
    
    console.log(`📅 Found ${availableSlots.length} available slots for doctor ${doctorClerkId} on ${date}`);
    
    res.json({
      date: appointmentDate.toISOString().split('T')[0],
      availableSlots: formattedSlots,
      totalAvailable: availableSlots.length,
      operatingHours: '5:00 AM - 9:00 PM',
      timezone: 'Asia/Kolkata'
    });
    
  } catch (error) {
    console.error('❌ Error fetching available slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new appointment
router.post('/create', async (req, res) => {
  try {
    const {
      doctorClerkId,
      patientClerkId,
      appointmentDate,
      timeSlot,
      duration = 30,
      consultationType = 'general',
      symptoms = [],
      notes = ''
    } = req.body;

    // Validate required fields
    if (!doctorClerkId || !patientClerkId || !appointmentDate || !timeSlot) {
      return res.status(400).json({ 
        error: 'Missing required fields: doctorClerkId, patientClerkId, appointmentDate, timeSlot' 
      });
    }

    // Validate appointment time
    const validation = validateAppointmentTime(appointmentDate, timeSlot);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid appointment time',
        details: validation.errors
      });
    }

    // Check if doctor exists
    const doctor = await Doctor.findOne({ clerkUserId: doctorClerkId });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check if patient exists
    const patient = await Patient.findOne({ clerkUserId: patientClerkId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if time slot is available
    const selectedDate = new Date(appointmentDate);
    const availableSlots = await getAvailableSlots(doctorClerkId, selectedDate, duration);
    
    if (!availableSlots.includes(timeSlot)) {
      return res.status(409).json({ 
        error: 'Time slot not available',
        availableSlots: availableSlots
      });
    }

    // Generate appointment ID
    const appointmentId = `APT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Generate meeting room ID
    const meetingRoomId = `room_${appointmentId}_${Date.now()}`;

    // Create appointment
    const appointment = new Appointment({
      appointmentId,
      patientId: patient._id,
      doctorId: doctor._id,
      patientClerkId,
      doctorClerkId,
      appointmentDate: selectedDate,
      appointmentTime: timeSlot,
      timeSlot,
      duration: parseInt(duration),
      consultationType,
      symptoms: Array.isArray(symptoms) ? symptoms : [],
      notes,
      meetingRoomId,
      status: 'scheduled'
    });

    await appointment.save();

    // Populate the response with doctor and patient details
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name specialty experience profileImage')
      .populate('patientId', 'name email profileImage age gender');

    console.log('✅ Appointment created:', appointmentId);
    
    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointmentId,
      meetingRoomId,
      appointment: populatedAppointment
    });

  } catch (error) {
    console.error('❌ Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get appointments for a patient
router.get('/patient/:patientClerkId', async (req, res) => {
  try {
    const { patientClerkId } = req.params;
    const { status, limit = 10, page = 1, upcoming = false } = req.query;

    let query = { patientClerkId };
    
    if (status) {
      query.status = status;
    }
    
    if (upcoming === 'true') {
      const now = new Date();
      query.appointmentDate = { $gte: now };
      query.status = { $in: ['scheduled', 'ongoing'] };
    }

    const appointments = await Appointment.find(query)
      .populate('doctorId', 'name specialty experience profileImage')
      .sort({ appointmentDate: upcoming === 'true' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching patient appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get appointments for a doctor
router.get('/doctor/:doctorClerkId', async (req, res) => {
  try {
    const { doctorClerkId } = req.params;
    const { status, date, limit = 10, page = 1, today = false } = req.query;

    let query = { doctorClerkId };
    
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const selectedDate = new Date(date);
      query.appointmentDate = {
        $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
        $lt: new Date(selectedDate.setHours(23, 59, 59, 999))
      };
    } else if (today === 'true') {
      const today = new Date();
      query.appointmentDate = {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999))
      };
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email profileImage age gender')
      .sort({ appointmentDate: 1, timeSlot: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching doctor appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single appointment by ID
router.get('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({ appointmentId })
      .populate('doctorId', 'name specialty experience profileImage')
      .populate('patientId', 'name email profileImage age gender');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Add additional computed fields
    const appointmentData = appointment.toObject();
    appointmentData.canBeCancelled = appointment.canBeCancelled();
    appointmentData.canBeRescheduled = appointment.canBeRescheduled();
    appointmentData.isStartingSoon = appointment.isStartingSoon();

    res.json(appointmentData);

  } catch (error) {
    console.error('❌ Error fetching appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update appointment status
router.patch('/:appointmentId/status', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, callStartTime, callEndTime } = req.body;

    const validStatuses = ['scheduled', 'ongoing', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    const updateData = { status };

    // Handle call timing
    if (status === 'ongoing' && callStartTime) {
      updateData.callStartTime = new Date(callStartTime);
    }

    if (status === 'completed' && callEndTime) {
      updateData.callEndTime = new Date(callEndTime);
      
      // Calculate duration if we have both times
      const appointment = await Appointment.findOne({ appointmentId });
      if (appointment && appointment.callStartTime) {
        const duration = Math.round((new Date(callEndTime) - appointment.callStartTime) / (1000 * 60));
        updateData.callDuration = duration;
      }
    }

    const appointment = await Appointment.findOneAndUpdate(
      { appointmentId },
      updateData,
      { new: true }
    ).populate('doctorId', 'name specialty')
     .populate('patientId', 'name email');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    console.log(`✅ Appointment ${appointmentId} status updated to ${status}`);
    res.json(appointment);

  } catch (error) {
    console.error('❌ Error updating appointment status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel appointment
router.post('/:appointmentId/cancel', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { cancelReason = 'Cancelled by user' } = req.body;

    const appointment = await Appointment.findOne({ appointmentId });
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!appointment.canBeCancelled()) {
      return res.status(400).json({ 
        error: 'Appointment cannot be cancelled. Must be at least 2 hours before appointment time.' 
      });
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = cancelReason;
    await appointment.save();

    console.log(`✅ Appointment ${appointmentId} cancelled`);
    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment
    });

  } catch (error) {
    console.error('❌ Error cancelling appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reschedule appointment
router.post('/:appointmentId/reschedule', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTimeSlot } = req.body;

    if (!newDate || !newTimeSlot) {
      return res.status(400).json({ 
        error: 'Missing required fields: newDate, newTimeSlot' 
      });
    }

    const appointment = await Appointment.findOne({ appointmentId });
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!appointment.canBeRescheduled()) {
      return res.status(400).json({ 
        error: 'Appointment cannot be rescheduled. Must be at least 4 hours before appointment time.' 
      });
    }

    // Validate new appointment time
    const validation = validateAppointmentTime(newDate, newTimeSlot);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid new appointment time',
        details: validation.errors
      });
    }

    // Check if new time slot is available
    const selectedDate = new Date(newDate);
    const availableSlots = await getAvailableSlots(appointment.doctorClerkId, selectedDate);
    
    if (!availableSlots.includes(newTimeSlot)) {
      return res.status(409).json({ 
        error: 'New time slot not available',
        availableSlots: availableSlots
      });
    }

    // Create new appointment record
    const newAppointmentId = `APT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const newMeetingRoomId = `room_${newAppointmentId}_${Date.now()}`;

    const newAppointment = new Appointment({
      appointmentId: newAppointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      patientClerkId: appointment.patientClerkId,
      doctorClerkId: appointment.doctorClerkId,
      appointmentDate: selectedDate,
      appointmentTime: newTimeSlot,
      timeSlot: newTimeSlot,
      duration: appointment.duration,
      consultationType: appointment.consultationType,
      symptoms: appointment.symptoms,
      notes: appointment.notes,
      meetingRoomId: newMeetingRoomId,
      status: 'scheduled',
      rescheduledFrom: appointment._id
    });

    await newAppointment.save();

    // Cancel old appointment
    appointment.status = 'cancelled';
    appointment.cancelReason = 'Rescheduled';
    await appointment.save();

    const populatedNewAppointment = await Appointment.findById(newAppointment._id)
      .populate('doctorId', 'name specialty experience profileImage')
      .populate('patientId', 'name email profileImage');

    console.log(`✅ Appointment ${appointmentId} rescheduled to ${newAppointmentId}`);
    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      oldAppointmentId: appointmentId,
      newAppointmentId,
      appointment: populatedNewAppointment
    });

  } catch (error) {
    console.error('❌ Error rescheduling appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get operating hours and status
router.get('/system/operating-hours', (req, res) => {
  try {
    const isOpen = isWithinOperatingHours();
    const now = new Date();
    const currentHour = now.getHours();
    
    let status = 'closed';
    let message = 'We are currently closed';
    
    if (isOpen) {
      status = 'open';
      message = 'We are currently accepting appointments';
    } else if (currentHour < 5) {
      status = 'closed';
      message = 'We will open at 5:00 AM';
    } else if (currentHour > 21) {
      status = 'closed';
      message = 'We are closed for the day. We will open tomorrow at 5:00 AM';
    }

    res.json({
      operatingHours: {
        start: '05:00',
        end: '21:00',
        timezone: 'Asia/Kolkata'
      },
      currentStatus: {
        isOpen,
        status,
        message,
        currentTime: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      },
      slotDuration: '30 minutes',
      maxAdvanceBooking: '3 months',
      cancellationPolicy: 'Can cancel up to 2 hours before appointment',
      reschedulingPolicy: 'Can reschedule up to 4 hours before appointment'
    });

  } catch (error) {
    console.error('❌ Error fetching operating hours:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
