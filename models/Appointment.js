const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    required: true,
    unique: true
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
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true,
    validate: {
      validator: function(time) {
        // Validate time format (HH:MM) and range (05:00 - 21:00)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(time)) return false;
        
        const [hours, minutes] = time.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
        const startTime = 5 * 60; // 5:00 AM in minutes
        const endTime = 21 * 60;   // 9:00 PM in minutes
        
        return timeInMinutes >= startTime && timeInMinutes <= endTime;
      },
      message: 'Appointment time must be between 5:00 AM and 9:00 PM'
    }
  },
  timeSlot: {
    type: String,
    required: true,
    enum: [
      '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
      '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ]
  },
  duration: {
    type: Number,
    default: 30, // Duration in minutes
    enum: [15, 30, 45, 60]
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  consultationType: {
    type: String,
    enum: ['general', 'follow-up', 'urgent', 'routine-checkup'],
    default: 'general'
  },
  symptoms: [String],
  notes: {
    type: String,
    default: ''
  },
  meetingRoomId: {
    type: String,
    default: ''
  },
  prescriptionId: {
    type: String,
    default: ''
  },
  callStartTime: {
    type: Date
  },
  callEndTime: {
    type: Date
  },
  callDuration: {
    type: Number, // in minutes
    default: 0
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  remindersSent: {
    type: Boolean,
    default: false
  },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  cancelReason: {
    type: String,
    default: ''
  },
  patientRating: {
    type: Number,
    min: 1,
    max: 5
  },
  patientFeedback: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
AppointmentSchema.index({ appointmentDate: 1, timeSlot: 1 });
AppointmentSchema.index({ doctorClerkId: 1, appointmentDate: 1 });
AppointmentSchema.index({ patientClerkId: 1, appointmentDate: 1 });
AppointmentSchema.index({ status: 1, appointmentDate: 1 });

// Virtual for formatted date and time
AppointmentSchema.virtual('formattedDateTime').get(function() {
  const date = new Date(this.appointmentDate);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: this.timezone
  };
  return `${date.toLocaleDateString('en-IN', options)} at ${this.timeSlot}`;
});

// Method to check if appointment can be cancelled
AppointmentSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.timeSlot.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  // Can cancel if appointment is at least 2 hours away
  const timeDiff = appointmentDateTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  return hoursDiff >= 2 && this.status === 'scheduled';
};

// Method to check if appointment can be rescheduled
AppointmentSchema.methods.canBeRescheduled = function() {
  const now = new Date();
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.timeSlot.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  // Can reschedule if appointment is at least 4 hours away
  const timeDiff = appointmentDateTime.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  return hoursDiff >= 4 && this.status === 'scheduled';
};

// Method to check if appointment is starting soon
AppointmentSchema.methods.isStartingSoon = function() {
  const now = new Date();
  const appointmentDateTime = new Date(this.appointmentDate);
  const [hours, minutes] = this.timeSlot.split(':').map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  const timeDiff = appointmentDateTime.getTime() - now.getTime();
  const minutesDiff = timeDiff / (1000 * 60);
  
  // Starting soon if within 15 minutes
  return minutesDiff >= -5 && minutesDiff <= 15;
};

module.exports = mongoose.model('Appointment', AppointmentSchema);
