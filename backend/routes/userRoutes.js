const express = require('express');
const router = express.Router();
const { 
    verifyEmail, 
    sendOtp, 
    verifyOtp, 
    registerUser, 
    authUser, 
    getUserProgress, 
    saveUserProgress, 
    getStudents 
} = require('../controllers/userController');

// Email verification & OTP routes
router.post('/verify-email', verifyEmail);     // Verify email format and availability
router.post('/send-otp', sendOtp);             // Send OTP to email (with resend support)
router.post('/verify-otp', verifyOtp);         // Verify OTP code

// Authentication routes
router.post('/register', registerUser);        // Register new user with OTP verification
router.post('/login', authUser);               // Login user

// User management routes
router.get('/students', getStudents);          // Get all students (Teacher/Admin)
router.get('/progress/:id', getUserProgress);  // Get user progress
router.put('/progress/:id', saveUserProgress); // Update user progress

module.exports = router;
