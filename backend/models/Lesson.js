const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    standard: { type: String, enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], required: true },  // Target class
    section: { type: String, enum: ['A', 'B', 'C', 'D', 'E', 'ALL'], default: 'ALL' },  // Target section or ALL for all sections
    grade: { type: String, default: '8' },  // Legacy field - kept for backward compatibility
    language: {
        type: String,
        enum: ['English', 'Punjabi', 'Hindi'],
        default: 'English',
    },
    description: { type: String, default: '' },
    contentUrl: { type: String, default: '' },
    pdfUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    compressionStatus: {
        type: String,
        enum: ['none', 'processing', 'done', 'error'],
        default: 'none',
    },
    compressedContentUrl: { type: String, default: '' },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    tags: [String],
    isPublished: { type: Boolean, default: false },
    isDownloadable: { type: Boolean, default: true },
    schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Lesson', lessonSchema);
