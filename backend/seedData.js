const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Lesson = require('./models/Lesson');
const Quiz = require('./models/Quiz');
const User = require('./models/User');

const lessons = [
    { title: 'Mathematics: Algebra Foundations', subject: 'Mathematics', grade: '8', language: 'English', description: 'Learn basic algebraic concepts including variables, expressions, and equations.', duration: 45, isPublished: true, isDownloadable: true, tags: ['algebra', 'math'], contentUrl: 'https://www.youtube.com/watch?v=Jpi0hXcaA5k' },
    { title: 'Science: The Solar System', subject: 'Science', grade: '8', language: 'English', description: 'Explore our solar system — planets, moons, and beyond.', duration: 30, isPublished: true, isDownloadable: true, tags: ['science', 'space'], contentUrl: 'https://www.youtube.com/watch?v=rsc6e_JEDY0' },
    { title: 'Social Science: Human History', subject: 'Social Science', grade: '8', language: 'English', description: 'Understanding human progression through the ages.', duration: 40, isPublished: true, isDownloadable: true, tags: ['history', 'civics'], contentUrl: 'https://www.youtube.com/watch?v=x8fb9BcWdro' },
    { title: 'English: Grammar Basics', subject: 'English', grade: '8', language: 'English', description: 'Master English grammar — tenses, parts of speech, and sentence structure.', duration: 35, isPublished: true, isDownloadable: true, tags: ['english', 'grammar'], contentUrl: 'https://www.youtube.com/watch?v=oM4hhWMYsqY' },
    { title: 'Hindi: Vyakaran', subject: 'Hindi', grade: '8', language: 'Hindi', description: 'हिंदी व्याकरण — संज्ञा, सर्वनाम, क्रिया सीखें।', duration: 35, isPublished: true, isDownloadable: true, tags: ['hindi', 'grammar'], contentUrl: 'https://www.youtube.com/watch?v=88DkVgP2ACw' },
    { title: 'ਪੰਜਾਬੀ: ਮੁੱਢਲੀ ਵਿਆਕਰਣ', subject: 'Punjabi', grade: '8', language: 'Punjabi', description: 'ਪੰਜਾਬੀ ਵਿਆਕਰਣ ਸਿੱਖੋ — ਨਾਂਵ, ਪੜਨਾਂਵ, ਕਿਰਿਆ।', duration: 40, isPublished: true, isDownloadable: true, tags: ['punjabi'], contentUrl: 'https://www.youtube.com/watch?v=2AmldBXnzvY' },
    { title: 'Digital Literacy 101', subject: 'Computer', grade: '8', language: 'English', description: 'Basic computer skills — typing, internet safety, and file management.', duration: 50, isPublished: true, isDownloadable: true, tags: ['computer', 'digital'] },
];

const quizzes = [
    {
        title: 'Algebra Foundations Quiz',
        subject: 'Mathematics',
        grade: '8',
        language: 'English',
        timeLimit: 900,
        passingScore: 60,
        badgeAwarded: '⭐',
        totalPoints: 5,
        questions: [
            { questionText: 'What is the value of x in: 2x + 6 = 14?', type: 'mcq', options: ['2', '4', '6', '8'], correctAnswer: '4', points: 1, explanation: '2x = 14 - 6 = 8, so x = 4' },
            { questionText: 'An equation always has an equal sign.', type: 'true_false', options: [], correctAnswer: 'True', points: 1, explanation: 'An equation by definition uses the = sign.' },
            { questionText: 'Simplify: 3a + 2a = ?', type: 'fill_blank', options: [], correctAnswer: '5a', points: 1, explanation: 'Like terms: 3a + 2a = 5a' },
            { questionText: 'Which of these is a variable?', type: 'mcq', options: ['5', 'x', '+', '='], correctAnswer: 'x', points: 1, explanation: 'x is a variable because it represents an unknown value.' },
            { questionText: 'If y = 3, what is 4y?', type: 'mcq', options: ['7', '12', '34', '43'], correctAnswer: '12', points: 1, explanation: '4y = 4 × 3 = 12' },
        ],
    },
    {
        title: 'Solar System Quiz',
        subject: 'Science',
        grade: '8',
        language: 'English',
        timeLimit: 600,
        passingScore: 60,
        badgeAwarded: '🔬',
        totalPoints: 4,
        questions: [
            { questionText: 'Which planet is closest to the Sun?', type: 'mcq', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctAnswer: 'Mercury', points: 1, explanation: 'Mercury is the closest planet to the Sun.' },
            { questionText: 'The Sun is a star.', type: 'true_false', options: [], correctAnswer: 'True', points: 1, explanation: 'The Sun is indeed a star — a ball of hot gas.' },
            { questionText: 'How many planets are in our solar system?', type: 'fill_blank', options: [], correctAnswer: '8', points: 1, explanation: 'There are 8 planets in our solar system.' },
            { questionText: 'Which is the largest planet?', type: 'mcq', options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'], correctAnswer: 'Jupiter', points: 1, explanation: 'Jupiter is the largest planet in our solar system.' },
        ],
    },
];

const users = [
    { name: 'Aarav Sharma', email: 'aarav@student.nabha.edu', password: 'password123', role: 'student', schoolId: 'nabha-01', language: 'English', grade: '8A' },
    { name: 'Instructor Sharma', email: 'teacher@nabha.edu', password: 'password123', role: 'teacher', schoolId: 'nabha-01', language: 'English', subject: 'Mathematics' },
    { name: 'Principal Singh', email: 'admin@nabha.edu', password: 'password123', role: 'admin', schoolId: 'nabha-01', language: 'English' },
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log('Connected to MongoDB for seeding...');

        // Clear old data
        await Lesson.deleteMany({});
        await Quiz.deleteMany({});
        console.log('Cleared existing lessons and quizzes.');

        // Seed lessons
        const createdLessons = await Lesson.insertMany(lessons);
        console.log(`✅ Seeded ${createdLessons.length} lessons`);

        // Seed quizzes (link first quiz to first lesson)
        quizzes[0].lessonId = createdLessons[0]._id;
        quizzes[1].lessonId = createdLessons[1]._id;
        const createdQuizzes = await Quiz.insertMany(quizzes);
        console.log(`✅ Seeded ${createdQuizzes.length} quizzes`);

        // Seed users (upsert — don't duplicate if they already exist)
        for (const u of users) {
            const exists = await User.findOne({ email: u.email });
            if (!exists) {
                await User.create(u);
                console.log(`✅ Created user: ${u.email}`);
            } else {
                console.log(`⏭️  User already exists: ${u.email}`);
            }
        }

        console.log('\n🎉 Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        process.exit(1);
    }
};

seedDB();
