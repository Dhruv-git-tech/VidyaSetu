const Lesson = require('../models/Lesson');

// @desc    Get all lessons (with filters)
const getLessons = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([
            { _id: 'demo-1', title: 'Mathematics: Algebra Foundations', subject: 'Mathematics', grade: '8', language: 'English', description: 'Learn basic algebraic concepts', duration: 45, isPublished: true, isDownloadable: true, tags: ['algebra', 'math'], contentUrl: "https://www.youtube.com/watch?v=Jpi0hXcaA5k" },
            { _id: 'demo-2', title: 'Science: The Solar System', subject: 'Science', grade: '8', language: 'English', description: 'Explore our solar system', duration: 30, isPublished: true, isDownloadable: true, tags: ['science', 'space'], contentUrl: "https://www.youtube.com/watch?v=rsc6e_JEDY0" },
            { _id: 'demo-social', title: 'Social Science: Human History', subject: 'Social Science', grade: '8', language: 'English', description: 'Understanding human progression', duration: 40, isPublished: true, isDownloadable: true, tags: ['history', 'civics'], contentUrl: "https://www.youtube.com/watch?v=x8fb9BcWdro" },
            { _id: 'demo-3', title: 'English: Grammar Basics', subject: 'English', grade: '8', language: 'English', description: 'Master English grammar', duration: 35, isPublished: true, isDownloadable: true, tags: ['english', 'grammar'], contentUrl: "https://www.youtube.com/watch?v=oM4hhWMYsqY" },
            { _id: 'demo-hindi', title: 'Hindi: Vyakaran', subject: 'Hindi', grade: '8', language: 'Hindi', description: 'Learn Hindi basics', duration: 35, isPublished: true, isDownloadable: true, tags: ['hindi', 'grammar'], contentUrl: "https://www.youtube.com/watch?v=88DkVgP2ACw" },
            { _id: 'demo-4', title: 'ਪੰਜਾਬੀ: ਮੁੱਢਲੀ ਵਿਆਕਰਣ', subject: 'Punjabi', grade: '8', language: 'Punjabi', description: 'ਪੰਜਾਬੀ ਵਿਆਕਰਣ ਸਿੱਖੋ', duration: 40, isPublished: true, isDownloadable: true, tags: ['punjabi'], contentUrl: "https://www.youtube.com/watch?v=2AmldBXnzvY" },
            { _id: 'demo-5', title: 'Digital Literacy 101', subject: 'Computer', grade: '8', language: 'English', description: 'Basic computer skills', duration: 50, isPublished: true, isDownloadable: true, tags: ['computer', 'digital'] },
        ]);
    }
    try {
        const { subject, grade, language } = req.query;
        const filter = { isPublished: true };
        if (subject) filter.subject = subject;
        if (grade) filter.grade = grade;
        if (language) filter.language = language;
        const lessons = await Lesson.find(filter).sort({ createdAt: -1 });
        res.json(lessons);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get single lesson
const getLessonById = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id).populate('quizId');
        if (lesson) return res.json(lesson);
        res.status(404).json({ message: 'Lesson not found' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Create lesson (Teacher/Admin only)
const createLesson = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.status(201).json({ _id: `demo-${Date.now()}`, ...req.body, isPublished: true });
    }
    try {
        const lesson = await Lesson.create({ ...req.body, createdBy: req.user?.userId || req.body.createdBy });
        res.status(201).json(lesson);
    } catch (error) {
        res.status(400).json({ message: 'Invalid lesson data', error: error.message });
    }
};

// @desc    Update lesson
const updateLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (lesson) return res.json(lesson);
        res.status(404).json({ message: 'Lesson not found' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete lesson
const deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findByIdAndDelete(req.params.id);
        if (lesson) return res.json({ message: 'Lesson removed' });
        res.status(404).json({ message: 'Lesson not found' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getLessons, getLessonById, createLesson, updateLesson, deleteLesson };
