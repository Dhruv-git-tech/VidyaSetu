const Lesson = require('../models/Lesson');
const { createNotification } = require('./notificationController');
const { getIO } = require('../socketInstance');

// @desc    Get all lessons (with filters)
const getLessons = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([
            { _id: 'demo-1', title: 'Mathematics: Algebra Foundations', subject: 'Mathematics', standard: '8', section: 'ALL', language: 'English', description: 'Learn basic algebraic concepts', duration: 45, isPublished: true, isDownloadable: true, tags: ['algebra', 'math'], contentUrl: "https://www.youtube.com/watch?v=Jpi0hXcaA5k" },
            { _id: 'demo-2', title: 'Science: The Solar System', subject: 'Science', standard: '8', section: 'ALL', language: 'English', description: 'Explore our solar system', duration: 30, isPublished: true, isDownloadable: true, tags: ['science', 'space'], contentUrl: "https://www.youtube.com/watch?v=rsc6e_JEDY0" },
            { _id: 'demo-social', title: 'Social Science: Human History', subject: 'Social Science', standard: '8', section: 'ALL', language: 'English', description: 'Understanding human progression', duration: 40, isPublished: true, isDownloadable: true, tags: ['history', 'civics'], contentUrl: "https://www.youtube.com/watch?v=x8fb9BcWdro" },
            { _id: 'demo-3', title: 'English: Grammar Basics', subject: 'English', standard: '8', section: 'ALL', language: 'English', description: 'Master English grammar', duration: 35, isPublished: true, isDownloadable: true, tags: ['english', 'grammar'], contentUrl: "https://www.youtube.com/watch?v=oM4hhWMYsqY" },
            { _id: 'demo-hindi', title: 'Hindi: Vyakaran', subject: 'Hindi', standard: '8', section: 'ALL', language: 'Hindi', description: 'Learn Hindi basics', duration: 35, isPublished: true, isDownloadable: true, tags: ['hindi', 'grammar'], contentUrl: "https://www.youtube.com/watch?v=88DkVgP2ACw" },
            { _id: 'demo-4', title: 'ਪੰਜਾਬੀ: ਮੁੱਢਲੀ ਵਿਆਕਰਣ', subject: 'Punjabi', standard: '8', section: 'ALL', language: 'Punjabi', description: 'ਪੰਜਾਬੀ ਵਿਆਕਰਣ ਸਿੱਖੋ', duration: 40, isPublished: true, isDownloadable: true, tags: ['punjabi'], contentUrl: "https://www.youtube.com/watch?v=2AmldBXnzvY" },
            { _id: 'demo-5', title: 'Digital Literacy 101', subject: 'Computer', standard: '8', section: 'ALL', language: 'English', description: 'Basic computer skills', duration: 50, isPublished: true, isDownloadable: true, tags: ['computer', 'digital'] },
        ]);
    }
    try {
        const { subject, standard, section, language, grade } = req.query;
        const filter = { isPublished: true };
        
        if (subject) filter.subject = subject;
        if (standard) filter.standard = standard;
        if (section) {
            // Show lessons for specific section OR lessons marked for ALL sections
            filter.section = { $in: [section, 'ALL'] };
        }
        if (language) filter.language = language;
        if (grade) filter.grade = grade;  // Legacy support
        
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
        return res.status(201).json({ _id: `demo-${Date.now()}`, ...req.body, isPublished: true, standard: req.body.standard || '8', section: req.body.section || 'ALL' });
    }
    
    // Validate required fields
    const { title, subject, standard } = req.body;
    if (!title || !subject || !standard) {
        return res.status(400).json({ message: 'Title, subject, and standard (class) are required' });
    }
    
    try {
        const lesson = await Lesson.create({ ...req.body, createdBy: req.user?.userId || req.body.createdBy });

        // Create notification for new lesson
        const notification = await createNotification({
            title: 'New Lesson Published',
            message: `"${lesson.title}" has been added to ${lesson.subject || 'your course'} for Class ${lesson.standard}`,
            type: 'lesson',
            referenceId: lesson._id.toString(),
            createdBy: req.user?.userId || req.body.createdBy,
            createdByName: req.body.createdByName || 'Teacher',
            targetRole: 'all',
        });
        // Broadcast real-time notification to all connected clients
        const io = getIO();
        if (io && notification) {
            io.emit('notification:new', notification.toObject());
        }

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
