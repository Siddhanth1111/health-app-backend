/**
 * Time Slot Management Utilities
 * Handles generation and validation of appointment time slots from 5 AM to 9 PM
 */

// Generate all available time slots from 5 AM to 9 PM
const generateTimeSlots = () => {
  const slots = [];
  const startHour = 5;  // 5 AM
  const endHour = 21;   // 9 PM
  
  for (let hour = startHour; hour <= endHour; hour++) {
    // Add :00 slot
    const hourStr = hour.toString().padStart(2, '0');
    slots.push(`${hourStr}:00`);
    
    // Add :30 slot (except for the last hour to not exceed 9 PM)
    if (hour < endHour) {
      slots.push(`${hourStr}:30`);
    }
  }
  
  return slots;
};

// Get available time slots for a specific date and doctor
const getAvailableSlots = async (doctorClerkId, date, duration = 30) => {
  const Appointment = require('../models/Appointment');
  
  // Get all possible slots
  const allSlots = generateTimeSlots();
  
  // Get booked appointments for this doctor on this date
  const bookedAppointments = await Appointment.find({
    doctorClerkId,
    appointmentDate: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    },
    status: { $in: ['scheduled', 'ongoing'] }
  });

  // Extract booked time slots
  const bookedSlots = new Set();
  bookedAppointments.forEach(appointment => {
    bookedSlots.add(appointment.timeSlot);
    
    // If appointment duration is more than 30 minutes, block additional slots
    if (appointment.duration > 30) {
      const additionalSlots = getBlockedSlotsForDuration(appointment.timeSlot, appointment.duration);
      additionalSlots.forEach(slot => bookedSlots.add(slot));
    }
  });

  // Filter available slots
  const availableSlots = allSlots.filter(slot => {
    // Check if slot is not booked
    if (bookedSlots.has(slot)) return false;
    
    // Check if requested duration fits (for longer appointments)
    if (duration > 30) {
      const requiredSlots = getBlockedSlotsForDuration(slot, duration);
      return requiredSlots.every(reqSlot => !bookedSlots.has(reqSlot));
    }
    
    return true;
  });

  return availableSlots;
};

// Get slots that would be blocked for a given duration
const getBlockedSlotsForDuration = (startTime, duration) => {
  const slots = [];
  const allSlots = generateTimeSlots();
  const startIndex = allSlots.indexOf(startTime);
  
  if (startIndex === -1) return slots;
  
  const slotsNeeded = Math.ceil(duration / 30);
  
  for (let i = 0; i < slotsNeeded && (startIndex + i) < allSlots.length; i++) {
    slots.push(allSlots[startIndex + i]);
  }
  
  return slots;
};

// Check if a time slot is valid (within operating hours)
const isValidTimeSlot = (timeSlot) => {
  const validSlots = generateTimeSlots();
  return validSlots.includes(timeSlot);
};

// Get formatted time slots with AM/PM format
const getFormattedTimeSlots = () => {
  const slots = generateTimeSlots();
  return slots.map(slot => {
    const [hour, minute] = slot.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    const formattedHour = displayHour === 0 ? 12 : displayHour;
    
    return {
      value: slot,
      label: `${formattedHour}:${minute.toString().padStart(2, '0')} ${period}`,
      hour: hour,
      minute: minute
    };
  });
};

// Group time slots by time periods
const getGroupedTimeSlots = () => {
  const allSlots = getFormattedTimeSlots();
  
  return {
    morning: allSlots.filter(slot => slot.hour >= 5 && slot.hour < 12),
    afternoon: allSlots.filter(slot => slot.hour >= 12 && slot.hour < 17),
    evening: allSlots.filter(slot => slot.hour >= 17 && slot.hour <= 21)
  };
};

// Check if current time is within operating hours
const isWithinOperatingHours = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= 5 && hour <= 21;
};

// Get next available time slot
const getNextAvailableTimeSlot = (currentTime = new Date()) => {
  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();
  
  // If before 5 AM, return 5:00 AM
  if (hour < 5) {
    return '05:00';
  }
  
  // If after 9 PM, return next day 5:00 AM
  if (hour >= 21) {
    return null; // Caller should handle next day
  }
  
  // Find next 30-minute slot
  const nextMinute = minute < 30 ? 30 : 0;
  const nextHour = minute < 30 ? hour : hour + 1;
  
  // If next hour exceeds operating hours
  if (nextHour > 21) {
    return null; // Caller should handle next day
  }
  
  return `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
};

// Calculate appointment end time
const calculateEndTime = (startTime, duration) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startInMinutes = startHour * 60 + startMinute;
  const endInMinutes = startInMinutes + duration;
  
  const endHour = Math.floor(endInMinutes / 60);
  const endMinute = endInMinutes % 60;
  
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
};

// Validate appointment timing constraints
const validateAppointmentTime = (date, timeSlot) => {
  const errors = [];
  
  // Check if time slot is valid
  if (!isValidTimeSlot(timeSlot)) {
    errors.push('Invalid time slot. Must be between 5:00 AM and 9:00 PM');
  }
  
  // Check if date is not in the past
  const appointmentDate = new Date(date);
  const now = new Date();
  
  if (appointmentDate < now.setHours(0, 0, 0, 0)) {
    errors.push('Cannot schedule appointments in the past');
  }
  
  // Check if appointment is not too far in the future (e.g., 3 months)
  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 3);
  
  if (appointmentDate > maxFutureDate) {
    errors.push('Cannot schedule appointments more than 3 months in advance');
  }
  
  // Check if trying to book for today but time has passed
  const today = new Date();
  if (appointmentDate.toDateString() === today.toDateString()) {
    const [hour, minute] = timeSlot.split(':').map(Number);
    const appointmentTime = new Date(appointmentDate);
    appointmentTime.setHours(hour, minute, 0, 0);
    
    if (appointmentTime <= now) {
      errors.push('Cannot schedule appointments in the past');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  generateTimeSlots,
  getAvailableSlots,
  getBlockedSlotsForDuration,
  isValidTimeSlot,
  getFormattedTimeSlots,
  getGroupedTimeSlots,
  isWithinOperatingHours,
  getNextAvailableTimeSlot,
  calculateEndTime,
  validateAppointmentTime
};
