const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    roomId: { type: String, required: true },
    senderId: { type: String, default: '' },
    senderName: { type: String, default: 'Anonymous' },
    senderRole: { type: String, enum: ['student', 'teacher'], default: 'student' },
    text: { type: String, required: true },
    type: { type: String, enum: ['text', 'announcement', 'quiz_result'], default: 'text' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    deliveredOffline: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
