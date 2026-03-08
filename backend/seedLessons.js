const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Lesson = require('./models/Lesson');
const User = require('./models/User');

dotenv.config();

const lessons = [
    {
        title: 'Mathematics: Algebra Foundations',
        subject: 'Mathematics',
        grade: '8',
        language: 'English',
        description: 'Learn basic algebraic concepts and solve equations. A fundamental topic for high school readiness.',
        duration: 45,
        isPublished: true,
        isDownloadable: true,
        tags: ['algebra', 'math'],
        contentUrl: 'https://youtu.be/Jpi0hXcaA5k'
    },
    {
        title: 'Science: The Solar System',
        subject: 'Science',
        grade: '8',
        language: 'English',
        description: 'Explore our solar system, individual planets, and their orbits. Includes amazing visual demonstrations.',
        duration: 30,
        isPublished: true,
        isDownloadable: true,
        tags: ['science', 'space'],
        contentUrl: 'https://youtu.be/rsc6e_JEDY0'
    },
    {
        title: 'Social Science: Understanding History',
        subject: 'Social Science',
        grade: '8',
        language: 'English',
        description: 'A deep dive into historical progressions and how human societies evolved over time.',
        duration: 40,
        isPublished: true,
        isDownloadable: true,
        tags: ['history', 'civics'],
        contentUrl: 'https://youtu.be/x8fb9BcWdro'
    },
    {
        title: 'English: Grammar Basics',
        subject: 'English',
        grade: '8',
        language: 'English',
        description: 'Master English grammar rules effortlessly. This lesson covers tenses, active/passive voice, and more.',
        duration: 35,
        isPublished: true,
        isDownloadable: true,
        tags: ['english', 'grammar'],
        contentUrl: 'https://youtu.be/oM4hhWMYsqY'
    },
    {
        title: 'Hindi: Vyakaran',
        subject: 'Hindi',
        grade: '8',
        language: 'Hindi',
        description: 'Learn Hindi basics and fundamental vyakaran (grammar) used in everyday writing.',
        duration: 35,
        isPublished: true,
        isDownloadable: true,
        tags: ['hindi', 'grammar'],
        contentUrl: 'https://youtu.be/88DkVgP2ACw'
    },
    {
        title: 'Punjabi: ਮੁੱਢਲੀ ਵਿਆਕਰਣ',
        subject: 'Punjabi',
        grade: '8',
        language: 'Punjabi',
        description: 'ਪੰਜਾਬੀ ਵਿਆਕਰਣ ਸਿੱਖੋ (Learn Punjabi grammar). Crucial module for state board students.',
        duration: 40,
        isPublished: true,
        isDownloadable: true,
        tags: ['punjabi'],
        contentUrl: 'https://youtu.be/2AmldBXnzvY'
    }
];

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('DB connected for seeding...');

        // Need a dummy admin/teacher to satisfy `createdBy` ref
        let teacher = await User.findOne({ email: 'teacher@nabha.edu' });
        if (!teacher) {
            teacher = await User.create({
                name: 'Master Ji',
                email: 'teacher@nabha.edu',
                password: 'password123',
                role: 'teacher'
            });
            console.log('Created test teacher.');
        }

        // Attach teacher as creator
        const lessonsWithCreator = lessons.map(lesson => ({
            ...lesson,
            createdBy: teacher._id
        }));

        // Insert or update based on title to avoid duplicates
        let updatedCount = 0;
        let insertedCount = 0;
        for (const l of lessonsWithCreator) {
            const existing = await Lesson.findOne({ title: l.title });
            if (existing) {
                existing.contentUrl = l.contentUrl;
                existing.subject = l.subject;
                await existing.save();
                updatedCount++;
            } else {
                await Lesson.create(l);
                insertedCount++;
            }
        }

        console.log(`Seeding complete! Inserted: ${insertedCount}, Updated: ${updatedCount}`);
        mongoose.disconnect();
    } catch (e) {
        console.error('Seeding error:', e);
        mongoose.disconnect();
    }
};

seedDatabase();
