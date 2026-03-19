const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Load env variables
dotenv.config();

const { setIO } = require('./services/videoCompressor');

// We will skip strict connection failure for demo purposes so server runs locally without a valid MongoDB URI
const connectDB = require('./config/db');
connectDB().catch(err => console.log('Mongodb connect deferred. Please add valid URI to .env'));

const app = express();
const server = http.createServer(app);

// Setup Socket.IO for Real-Time features
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Wire Socket.IO into the video compression service
setIO(io);

// Share Socket.IO instance for controllers (notifications, etc.)
const socketInstance = require('./socketInstance');
socketInstance.setIO(io);

// Middlewares
app.use(cors());
app.use(express.json()); // Allows parsing JSON bodies
app.use(express.urlencoded({ extended: false }));

// Mount Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/lessons', require('./routes/lessonRoutes'));
app.use('/api/quizzes', require('./routes/quizRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Serve uploaded content (raw and compressed subdirs included)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Basic health check route
app.get('/', (req, res) => {
    res.send('Vidya Setu API is Running...');
});

// Socket.io Connection Logic — Full Real-time System (Spec 30)
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // ── PRESENCE ──
    socket.on('join_class', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        console.log(`${socket.id} joined room: ${roomId}`);
        io.to(roomId).emit('presence:user_joined', { userId: socket.id, name: 'User', role: 'student' });
        const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        io.to(roomId).emit('presence:online_count', { roomId, count });
    });

    socket.on('presence:join', (data) => {
        socket.join(data.roomId);
        socket.roomId = data.roomId;
        io.to(data.roomId).emit('presence:user_joined', { userId: socket.id, name: data.name || 'User', role: data.role || 'student' });
        const count = io.sockets.adapter.rooms.get(data.roomId)?.size || 0;
        io.to(data.roomId).emit('presence:online_count', { roomId: data.roomId, count });
    });

    socket.on('presence:leave', (data) => {
        socket.leave(data.roomId);
        io.to(data.roomId).emit('presence:user_left', { userId: socket.id });
    });

    // ── STUDENT PROGRESS (Legacy + New) ──
    socket.on('student_progress', (data) => {
        io.to(data.roomId).emit('update_teacher_dashboard', data);
    });

    // ── CHAT ──
    socket.on('chat:join', (data) => {
        socket.join(data.roomId);
    });

    socket.on('chat:send', (data) => {
        const message = {
            _id: `msg-${Date.now()}`,
            roomId: data.roomId,
            senderId: data.senderId || socket.id,
            senderName: data.senderName || 'User',
            senderRole: data.senderRole || 'student',
            text: data.text,
            type: 'text',
            timestamp: new Date(),
        };
        io.to(data.roomId).emit('chat:message', message);

        // Persist message to MongoDB if connected
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
            const Message = require('./models/Message');
            Message.create(message).catch(err => console.log('Chat save error:', err.message));
        }
    });

    socket.on('chat:typing', (data) => {
        socket.to(data.roomId).emit('chat:typing_indicator', { name: data.name || 'Someone' });
    });

    socket.on('chat:stop_typing', (data) => {
        socket.to(data.roomId).emit('chat:stop_typing_indicator', { name: data.name || 'Someone' });
    });

    socket.on('chat:leave', (data) => {
        socket.leave(data.roomId);
    });

    // Teacher chat controls
    socket.on('chat:delete_message', (data) => {
        io.to(data.roomId).emit('chat:message_deleted', { messageId: data.messageId });
    });

    socket.on('chat:mute_all', (data) => {
        io.to(data.roomId).emit('chat:muted', { muted: data.muted });
    });

    socket.on('chat:pin_message', (data) => {
        io.to(data.roomId).emit('chat:pinned', { message: data.message });
    });

    // ── QUIZ LIVE ──
    socket.on('quiz:start', (data) => {
        io.to(data.roomId).emit('quiz:started', { quiz: data.quiz, quizId: data.quizId });
    });

    socket.on('quiz:answer', (data) => {
        io.to(data.roomId).emit('quiz:answer_received', { studentId: data.studentId, questionId: data.questionId });
    });

    socket.on('quiz:submit', (data) => {
        io.to(data.roomId).emit('quiz:submission_received', { studentId: data.studentId });
    });

    socket.on('quiz:end', (data) => {
        io.to(data.roomId).emit('quiz:ended', { quizId: data.quizId });
    });

    socket.on('quiz:request_results', (data) => {
        io.to(data.roomId).emit('quiz:results', { quizId: data.quizId, results: data.results || [] });
    });

    // ── CLASS CONTROL ──
    socket.on('class:start', (data) => {
        io.to(data.roomId).emit('class:started', { teacherName: data.teacherName || 'Teacher', subject: data.subject || 'General' });
    });

    socket.on('class:end', (data) => {
        io.to(data.roomId).emit('class:ended', {});
    });

    socket.on('class:announce', async (data) => {
        io.to(data.roomId).emit('class:announcement', { title: data.title, body: data.body });
        // Persist announcement as a notification
        const { createNotification } = require('./controllers/notificationController');
        const notification = await createNotification({
            title: data.title,
            message: data.body,
            type: 'announcement',
            createdByName: data.teacherName || 'Teacher',
            targetRole: 'all',
        });
        if (notification) {
            io.emit('notification:new', notification.toObject());
        }
    });

    socket.on('progress:update', (data) => {
        // Relay progress from student to teacher in the room
        io.to(socket.roomId || 'class-8a').emit('update_teacher_dashboard', data);
    });

    // ── SYNC (Offline Data Handshake) ──
    socket.on('sync:request', (data) => {
        // In production: query DB for changes since lastSyncedAt
        socket.emit('sync:data', { newLessons: [], updatedProgress: [] });
    });

    socket.on('sync:acknowledge', (data) => {
        console.log(`Sync acknowledged by ${socket.id}`);
    });

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
        if (socket.roomId) {
            io.to(socket.roomId).emit('presence:user_left', { userId: socket.id });
            const count = io.sockets.adapter.rooms.get(socket.roomId)?.size || 0;
            io.to(socket.roomId).emit('presence:online_count', { roomId: socket.roomId, count });
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start Server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server executing in ${process.env.NODE_ENV} mode on port ${PORT}`));
// Triggered restart
