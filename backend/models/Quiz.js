const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'true_false', 'fill_blank'], default: 'mcq' },
    options: [String],
    correctAnswer: { type: String, required: true },
    points: { type: Number, default: 1 },
    explanation: { type: String, default: '' },
});

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    subject: { type: String, default: '' },
    standard: { type: String, enum: ['4', '5', '6', '7', '8', '9', '10', '11', '12'], required: true },  // Target class (4-12)
    grade: { type: String, default: '8' },  // Legacy field
    language: { type: String, enum: ['English', 'Punjabi', 'Hindi'], default: 'English' },
    questions: [questionSchema],
    totalPoints: { type: Number, default: 0 },
    timeLimit: { type: Number, default: 0 },
    passingScore: { type: Number, default: 60 },
    badgeAwarded: { type: String, default: '' },
    createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
