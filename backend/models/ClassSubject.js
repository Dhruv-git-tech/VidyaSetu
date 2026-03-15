const mongoose = require('mongoose');

const classSubjectSchema = new mongoose.Schema({
    standard: { type: String, enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], required: true },
    section: { type: String, enum: ['A', 'B', 'C', 'D', 'E', 'ALL'], required: true },
    subject: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherName: { type: String, required: true },
    academicYear: { type: String, default: '2025-2026' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Ensure unique combination of standard, section, and subject
classSubjectSchema.index({ standard: 1, section: 1, subject: 1, teacherId: 1 }, { unique: true });

module.exports = mongoose.model('ClassSubject', classSubjectSchema);
