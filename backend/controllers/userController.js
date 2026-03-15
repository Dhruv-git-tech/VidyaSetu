const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { sendFirebaseEmailOTP, verifyFirebaseOTP, createFirebaseUser } = require('../config/firebase');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d',
    });
};

/**
 * Verify email format and availability
 */
const verifyEmail = async (req, res) => {
    const { email } = req.body;
    const mongoose = require('mongoose');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(200).json({ 
            valid: true, 
            available: true,
            message: 'Email format valid (DB offline)' 
        });
    }

    try {
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({ 
                valid: true, 
                available: false,
                message: 'Email already registered. Please login.' 
            });
        }

        return res.status(200).json({ 
            valid: true, 
            available: true,
            message: 'Email is available for registration' 
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Send OTP to email using Firebase
 */
const sendOtp = async (req, res) => {
    const { email, isResend } = req.body;
    const mongoose = require('mongoose');

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    try {
        // Check if user already exists
        if (mongoose.connection.readyState === 1) {
            const userExists = await User.findOne({ email: email.toLowerCase() });
            if (userExists) {
                return res.status(400).json({ 
                    message: 'Email already registered. Please login.',
                    shouldLogin: true 
                });
            }

            // Check for existing OTP and rate limit
            const existingOTP = await OTP.findOne({ email: email.toLowerCase() });
            
            if (existingOTP && !isResend) {
                const timeSinceSent = Date.now() - new Date(existingOTP.createdAt).getTime();
                if (timeSinceSent < 60000) { // 1 minute cooldown
                    const waitTime = Math.ceil((60000 - timeSinceSent) / 1000);
                    return res.status(429).json({ 
                        message: `Please wait ${waitTime} seconds before requesting a new OTP`,
                        canResendIn: waitTime 
                    });
                }
            }

            // Check daily limit (max 5 OTPs per day)
            if (existingOTP && (existingOTP.attempts || 0) >= 5) {
                const daySinceReset = Date.now() - new Date(existingOTP.createdAt).getTime();
                if (daySinceReset < 24 * 60 * 60 * 1000) {
                    return res.status(429).json({ 
                        message: 'Too many OTP requests. Please try again after 24 hours.',
                        maxAttemptsReached: true 
                    });
                }
            }
        }

        // Generate and store OTP via Firebase
        const otpResult = await sendFirebaseEmailOTP(email);

        res.status(200).json({ 
            message: 'OTP sent successfully',
            email: email,
            expiresInSeconds: 300,
            canResendAfter: 60,
            // Development mode - OTP shown in console
            // In production, integrate with email service (Resend, SendGrid, etc.)
            _otp: otpResult.otp // Remove in production
        });

    } catch (error) {
        console.error('[SEND OTP ERROR]', error.message);
        res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }
};

/**
 * Verify OTP
 */
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    const mongoose = require('mongoose');

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    if (mongoose.connection.readyState !== 1) {
        // Fallback for development
        if (otp.length === 6 && /^\d+$/.test(otp)) {
            return res.status(200).json({ 
                message: 'OTP verified (DB offline)',
                verified: true 
            });
        }
        return res.status(400).json({ message: 'Invalid OTP format' });
    }

    try {
        const result = await verifyFirebaseOTP(email.toLowerCase(), otp);

        if (result.valid) {
            res.status(200).json({ 
                message: result.message,
                verified: true,
                email: result.email 
            });
        } else {
            const statusCode = result.maxAttemptsReached ? 429 : 400;
            res.status(statusCode).json({ 
                message: result.message,
                remainingAttempts: result.remainingAttempts,
                maxAttemptsReached: result.maxAttemptsReached,
                expired: result.message.includes('expired')
            });
        }

    } catch (error) {
        console.error('[VERIFY OTP ERROR]', error.message);
        res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
    }
};

/**
 * Register user with Firebase Email Auth
 */
const registerUser = async (req, res) => {
    const { name, email, password, role, schoolId, language, otp, standard, section, age, parentName, parentOccupation, parentMobile, address, subject, phone, qualification, experience } = req.body;
    const mongoose = require('mongoose');

    // Validation
    if (!name || !email || !password || !otp) {
        return res.status(400).json({ message: 'Name, email, password, and OTP are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (mongoose.connection.readyState !== 1) {
        // Fallback demo
        return res.status(201).json({
            _id: `mock-${role}-${Date.now()}`,
            name,
            email,
            role: role || 'student',
            schoolId: schoolId || 'nabha-01',
            language: language || 'English',
            standard: role === 'student' ? (standard || '') : '',
            section: role === 'student' ? (section || '') : '',
            subject: role === 'teacher' ? (subject || '') : '',
            phone: role === 'teacher' ? (phone || '') : '',
            qualification: role === 'teacher' ? (qualification || '') : '',
            experience: role === 'teacher' ? (experience || '') : '',
            age: age || 0,
            parentName: role === 'student' ? (parentName || '') : '',
            parentOccupation: role === 'student' ? (parentOccupation || '') : '',
            parentMobile: role === 'student' ? (parentMobile || '') : '',
            address: address || '',
            token: generateToken(`mock-${role}`),
        });
    }

    try {
        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists. Please login.' });
        }

        // Verify OTP first
        const otpVerification = await verifyFirebaseOTP(email.toLowerCase(), otp);
        if (!otpVerification.valid) {
            return res.status(400).json({
                message: otpVerification.message,
                shouldRequestOtp: otpVerification.message.includes('expired') || otpVerification.message.includes('No OTP')
            });
        }

        // Create user in MongoDB based on role
        const userData = {
            name,
            email: email.toLowerCase(),
            password,
            role: role || 'student',
            schoolId: schoolId || 'nabha-01',
            language: language || 'English',
            age: age || 0,
            address: address || '',
        };

        // Add student-specific fields
        if (role === 'student') {
            userData.standard = standard || '';
            userData.section = section || '';
            userData.parentName = parentName || '';
            userData.parentOccupation = parentOccupation || '';
            userData.parentMobile = parentMobile || '';
        }

        // Add teacher-specific fields
        if (role === 'teacher') {
            userData.subject = subject || '';
            userData.phone = phone || '';
            userData.qualification = qualification || '';
            userData.experience = experience || '';
        }

        const user = await User.create(userData);

        // Optionally create Firebase user (if Firebase is configured)
        if (process.env.FIREBASE_PROJECT_ID) {
            const firebaseResult = await createFirebaseUser(email, password, name);
            if (!firebaseResult.success) {
                console.warn('[Firebase] User creation failed:', firebaseResult.message);
            }
        }

        // Return response based on role
        const responseData = {
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            language: user.language,
            address: user.address,
            token: generateToken(user._id),
        };

        if (role === 'student') {
            responseData.standard = user.standard;
            responseData.section = user.section;
            responseData.age = user.age;
            responseData.parentName = user.parentName;
            responseData.parentOccupation = user.parentOccupation;
            responseData.parentMobile = user.parentMobile;
        }

        if (role === 'teacher') {
            responseData.subject = user.subject;
            responseData.phone = user.phone;
            responseData.qualification = user.qualification;
            responseData.experience = user.experience;
            responseData.age = user.age;
        }

        return res.status(201).json(responseData);

    } catch (error) {
        console.error('[REGISTER ERROR]', error.message);
        return res.status(400).json({ message: 'Registration failed', error: error.message });
    }
};

/**
 * Login user
 */
const authUser = async (req, res) => {
    const { email, password } = req.body;
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
        return handleFallbackLogin(email, res);
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() }).maxTimeMS(2000);

        if (user && (await user.matchPassword(password))) {
            return res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
                language: user.language,
                token: generateToken(user._id),
            });
        } else {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        return handleFallbackLogin(email, res, error);
    }
};

const handleFallbackLogin = (email, res, error = null) => {
    if (email === 'aarav@student.nabha.edu') {
        return res.json({
            _id: 'mock-student-1',
            name: 'Aarav Sharma',
            email: 'aarav@student.nabha.edu',
            role: 'student',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-student-1'),
        });
    } else if (email === 'teacher@nabha.edu') {
        return res.json({
            _id: 'mock-teacher-1',
            name: 'Instructor Sharma',
            email: 'teacher@nabha.edu',
            role: 'teacher',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-teacher-1'),
        });
    } else if (email === 'admin@nabha.edu') {
        return res.json({
            _id: 'mock-admin-1',
            name: 'Principal Singh',
            email: 'admin@nabha.edu',
            role: 'admin',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-admin-1'),
        });
    }
    res.status(500).json({ message: 'Server error: MongoDB disconnected', error: error ? error.message : 'Not connected' });
};

/**
 * Get user progress
 */
const getUserProgress = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json({ name: 'Mock User', progress: [] });
    }

    try {
        const user = await User.findById(req.params.id);
        if (user) {
            return res.json({
                name: user.name,
                progress: user.progress
            });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Save/Update user progress
 */
const saveUserProgress = async (req, res) => {
    const { newProgressScore, chapter } = req.body;
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
        return res.json({ message: 'Progress saved successfully via mock fallback', progress: [] });
    }

    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.progress.length === 0) {
                user.progress.push({
                    status: 'in_progress',
                    score: newProgressScore,
                });
            } else {
                user.progress[0].score = newProgressScore;
                user.progress[0].status = newProgressScore === 100 ? 'completed' : 'in_progress';
            }

            await user.save();
            return res.json({ message: 'Progress saved successfully', progress: user.progress });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get all students
 */
const getStudents = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([
            { _id: 's1', name: 'Mock Aarav', progress: [{ score: 72 }] }
        ]);
    }

    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    verifyEmail,
    sendOtp,
    verifyOtp,
    registerUser,
    authUser,
    getUserProgress,
    saveUserProgress,
    getStudents
};
