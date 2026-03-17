const Quiz = require('../models/Quiz');
const { createNotification } = require('./notificationController');
const { getIO } = require('../socketInstance');

// @desc    Get all quizzes
const getQuizzes = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([
            {
                _id: 'quiz-demo-1', title: 'Weekly Math Quiz', subject: 'Mathematics', standard: '8', section: 'ALL',
                language: 'English', totalPoints: 10, timeLimit: 900, passingScore: 60, badgeAwarded: 'star',
                questions: [
                    { _id: 'q1', questionText: 'What is 5x + 3 when x = 4?', type: 'mcq', options: ['15', '20', '23', '28'], correctAnswer: '23', points: 1, explanation: '5(4)+3 = 23' },
                    { _id: 'q2', questionText: 'Is 7 a prime number?', type: 'true_false', options: ['True', 'False'], correctAnswer: 'True', points: 1, explanation: '7 is only divisible by 1 and itself' },
                    { _id: 'q3', questionText: 'What is 12 × 12?', type: 'mcq', options: ['124', '144', '132', '156'], correctAnswer: '144', points: 1, explanation: '12 × 12 = 144' },
                    { _id: 'q4', questionText: 'Solve: 2x = 10, x = ?', type: 'fill_blank', options: [], correctAnswer: '5', points: 1, explanation: 'x = 10/2 = 5' },
                    { _id: 'q5', questionText: 'What is the square root of 81?', type: 'mcq', options: ['7', '8', '9', '10'], correctAnswer: '9', points: 1, explanation: '9 × 9 = 81' },
                ]
            },
        ]);
    }
    try {
        const { standard } = req.query;
        const filter = {};
        
        if (standard) filter.standard = standard;
        
        const quizzes = await Quiz.find(filter).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get single quiz
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (quiz) return res.json(quiz);
        res.status(404).json({ message: 'Quiz not found' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Create quiz (Teacher/Admin)
const createQuiz = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.status(201).json({ _id: `quiz-${Date.now()}`, ...req.body });
    }
    try {
        const quiz = await Quiz.create({ ...req.body, createdBy: req.user?.userId || req.body.createdBy });

        // Create notification for new quiz with class-specific targeting
        const notification = await createNotification({
            title: 'New Quiz Available',
            message: `"${quiz.title}" — ${quiz.subject || 'General'} quiz for Class ${quiz.standard}`,
            type: 'quiz',
            referenceId: quiz._id.toString(),
            createdBy: req.user?.userId || req.body.createdBy,
            createdByName: req.body.createdByName || 'Teacher',
            targetRole: 'all',
            standard: quiz.standard || 'ALL',
        });
        const io = getIO();
        if (io && notification) {
            io.emit('notification:new', notification.toObject());
        }

        res.status(201).json(quiz);
    } catch (error) {
        res.status(400).json({ message: 'Invalid quiz data', error: error.message });
    }
};

// @desc    Submit quiz answers
const submitQuiz = async (req, res) => {
    const { answers } = req.body;
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        // Demo scoring — match answers against the hardcoded quiz
        const demoQuiz = [
            { correctAnswer: '23', points: 1 },
            { correctAnswer: 'True', points: 1 },
            { correctAnswer: '144', points: 1 },
            { correctAnswer: '5', points: 1 },
            { correctAnswer: '9', points: 1 },
        ];
        let score = 0;
        const totalPoints = demoQuiz.length;
        demoQuiz.forEach((q, i) => {
            if (answers && answers[i] && answers[i].answer === q.correctAnswer) {
                score += q.points;
            }
        });
        const percentage = Math.round((score / totalPoints) * 100);
        const passed = percentage >= 60;
        const badge = percentage >= 80 ? '🏅' : '';
        return res.json({ score, totalPoints, percentage, passed, badge });
    }
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        let score = 0;
        quiz.questions.forEach((q, i) => {
            if (answers[i] && answers[i].answer === q.correctAnswer) {
                score += q.points;
            }
        });

        const pct = Math.round((score / quiz.totalPoints) * 100);
        const passed = pct >= quiz.passingScore;
        const badge = passed ? quiz.badgeAwarded : '';

        res.json({ score, totalPoints: quiz.totalPoints, percentage: pct, passed, badge });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getQuizzes, getQuizById, createQuiz, submitQuiz };
