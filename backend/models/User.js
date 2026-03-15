const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    schoolId: { type: String, default: 'nabha-01' },
    phone: { type: String, default: '' },
    firebaseUid: { type: String, default: '' },
    grade: { type: String, default: '' },       // Students: e.g. "8A"
    subject: { type: String, default: '' },     // Teachers: e.g. "Mathematics"
    language: { type: String, enum: ['English', 'Punjabi', 'Hindi'], default: 'English' },
    schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    
    // Student specific fields
    standard: { type: String, enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], default: '' },  // Class standard (1-12)
    section: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], default: '' },  // Section within class
    age: { type: Number, default: 0 },
    parentName: { type: String, default: '' },
    parentOccupation: { type: String, default: '' },
    parentMobile: { type: String, default: '' },
    
    // Teacher specific fields
    qualification: { type: String, default: '' },
    experience: { type: String, default: '' },
    
    address: { type: String, default: '' },
    
    progress: [
        {
            lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
            status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
            score: { type: Number, default: 0 },
            lastAccessed: { type: Date },
            completedAt: { type: Date },
        },
    ],
    badges: [String],
    totalPoints: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Pre-save hook to hash password before saving to database
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to verify password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
