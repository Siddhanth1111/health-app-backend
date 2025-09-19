export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const ROUTES = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  DASHBOARD: '/dashboard',
  DOCTORS: '/doctors',
  CALL: '/call/:doctorId',
  PROFILE: '/profile',
  CONSULTATIONS: '/consultations',
  ONBOARDING: '/onboarding',
  NOT_FOUND: '*'
};

export const DOCTOR_SPECIALTIES = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pediatrician',
  'Orthopedic',
  'Gastroenterologist',
  'Neurologist',
  'Psychiatrist',
  'Gynecologist',
  'ENT Specialist',
  'Ophthalmologist',
  'Urologist'
];

export const SOCKET_EVENTS = {
  REGISTER_USER: 'register-user',
  USER_REGISTERED: 'user-registered',
  REGISTRATION_ERROR: 'registration-error',
  INITIATE_CALL: 'initiate-call',
  INCOMING_CALL: 'incoming-call',
  CALL_INITIATED: 'call-initiated',
  CALL_RESPONSE: 'call-response',
  CALLING: 'calling',
  DOCTOR_STATUS_CHANGED: 'doctor-status-changed',
  USER_NOT_AVAILABLE: 'user-not-available',
  ERROR: 'error'
};
