# Vidya Sahayak - Digital Learning Platform

<div align="center">

![Vidya Sahayak](https://img.shields.io/badge/Vidya_Sahayak-Digital_Learning-blue)
![React](https://img.shields.io/badge/React-18.3.1-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-23.2.0-339933)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)
![License](https://img.shields.io/badge/License-MIT-green)

**Empowering Rural Students in Punjab with Accessible, Offline-First Education**

</div>

---

## 📖 About

**Vidya Sahayak** (विद्या सहायक / ਵਿਦਿਆ ਸਹਾਇਕ) is a comprehensive digital learning platform specifically designed for rural students in Punjab (e.g., Nabha). Built with a **mobile-first, offline-first** approach, it ensures high-quality educational content is accessible even on low-end devices with limited connectivity.

### 🎯 Key Features

| Feature | Description |
|---------|-------------|
| 📱 **Student Portal** | Coursera-style mobile interface with progress tracking, interactive tests, and gamification |
| 👨‍🏫 **Teacher Dashboard** | Class analytics, lesson assignment, real-time assessment, and live quiz management |
| 🔄 **Real-Time Sync** | Socket.IO-powered live presence, chat, quiz, and progress updates |
| 📴 **Offline-First** | IndexedDB storage with automatic cloud sync when connectivity returns |
| 🌐 **PWA + Android** | Progressive Web App with optional native Android APK via Capacitor |
| 🎥 **Video Pipeline** | Automatic video compression (FFmpeg) and cloud storage (Cloudinary) |
| 📧 **Email Notifications** | OTP verification and notifications via Nodemailer |

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18.3.1 with Vite 7.x
- **Styling**: Tailwind CSS 3.x (mobile-first responsive design)
- **PWA**: vite-plugin-pwa with Workbox for offline caching
- **State**: IndexedDB (via `idb`) for offline data storage
- **Real-time**: Socket.IO Client 4.x
- **HTTP**: Axios 1.x with JWT authentication
- **Charts**: Recharts 3.x for teacher analytics
- **Media**: React Player 3.x for video lessons
- **Icons**: Lucide React
- **Mobile**: Capacitor 8.x for Android APK

### Backend
- **Runtime**: Node.js 23.x
- **Framework**: Express 4.x
- **Database**: MongoDB Atlas with Mongoose 8.x
- **Real-time**: Socket.IO 4.x
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **File Upload**: Multer 2.x
- **Video Processing**: fluent-ffmpeg + better-queue
- **Cloud Storage**: Cloudinary 2.x
- **Email**: Nodemailer 8.x

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

```bash
# Check versions
node --version    # v20 or higher (v23.2.0 tested)
npm --version     # v9 or higher
```

**Optional (for video compression):**
```bash
# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html

# Linux
sudo apt-get install ffmpeg
```

### 1. Clone the Repository

```bash
git clone <repository-url>
cd digital-learning-platform
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (see Environment Variables section)
cp .env.example .env  # or create manually

# Start development server
npm run dev
```

Backend will run on **http://localhost:5000**

### 3. Frontend Setup

```bash
# Open new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file (see Environment Variables section)
cp .env.example .env  # or create manually

# Start development server
npm run dev
```

Frontend will run on **http://localhost:5173**

---

## ⚙️ Environment Variables

### Backend (.env in `/backend`)

```env
# Database Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/vidya-sahayak

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this

# Cloudinary Configuration (for media storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Server Configuration
PORT=5001
NODE_ENV=development

# Firebase Admin SDK (Optional - for Firebase user management)
# Get from: https://console.firebase.google.com > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

> ⚠️ **Note**: Firebase is **OPTIONAL**. Your app works without it using backend OTP + MongoDB. See `FIREBASE_CREDENTIALS.md` for setup guide.

### Email Delivery (Optional - for production)

Currently OTPs are logged to console. For email delivery in production:

```env
# Resend API (Recommended - Free 100 emails/day)
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxx
```

### Frontend (.env in `/frontend`)

```env
# Backend API URL
VITE_API_URL=http://localhost:5000/api

# Socket.IO Server URL
VITE_SOCKET_URL=http://localhost:5000

# App Configuration
VITE_APP_NAME=Vidya Sahayak
```

> ⚠️ **Security Note**: Never commit `.env` files to version control. They are excluded via `.gitignore`.

---

## 📱 Building for Android

### Prerequisites
- Android Studio (Arctic Fox or higher)
- Android SDK (API level 21+)

### Build Steps

```bash
cd frontend

# Build production bundle
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Select **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Find APK in `frontend/android/app/build/outputs/apk/`

---

## 🏗️ Architecture

### Edge-to-Cloud Synchronization

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Student/      │         │   Node.js +     │         │   MongoDB       │
│   Teacher       │◄───────►│   Express +     │◄───────►│   Atlas         │
│   Device        │  REST/  │   Socket.IO     │  Cloud  │   (Cloud)       │
│   (Edge)        │  WS     │   (Server)      │         │                 │
│   IndexedDB     │         │                 │         │   Cloudinary    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
       │                           │                           │
       │  Offline: Queue actions   │                           │
       │  Online: Sync to cloud    │                           │
       └───────────────────────────┴───────────────────────────┘
```

### Offline-First Workflow

1. **Offline**: Data stored in IndexedDB, actions queued
2. **Reconnect**: Service Worker detects online status
3. **Sync**: Queued actions replayed to cloud API
4. **Conflict Resolution**: Smart merge (e.g., higher progress wins)

---

## 📂 Project Structure

```
digital-learning-platform/
├── backend/
│   ├── controllers/          # Request handlers (auth, lessons, users)
│   ├── models/               # MongoDB schemas (User, Lesson, Progress)
│   ├── routes/               # API route definitions
│   ├── services/             # Business logic (video compression, email)
│   ├── middleware/           # Auth, error handling, CORS
│   ├── .env                  # Environment variables (gitignored)
│   ├── server.js             # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Page components (Student, Teacher)
│   │   ├── services/         # API services (axios, socket)
│   │   ├── offline/          # IndexedDB, sync queue, service worker
│   │   ├── context/          # React context (auth, socket)
│   │   └── App.jsx           # Root component
│   ├── public/               # Static assets (icons, manifest)
│   ├── .env                  # Environment variables (gitignored)
│   └── package.json
│
├── nabha/                    # Project specifications (SIH2025)
├── diagrams/                 # Architecture diagrams
├── requirements.txt          # Detailed requirements document
├── PROJECT_DOCUMENTATION.md  # Comprehensive technical docs
└── README.md                 # This file
```

---

## 🎓 User Roles

### 👨‍🎓 Students
- Browse and access assigned lessons
- Watch video lessons (online/offline)
- Take quizzes and submit answers
- Track personal progress
- Earn badges and gamification points
- Participate in live class chat

### 👨‍🏫 Teachers
- Create and upload lessons (video, PDF)
- Assign lessons to classes
- Monitor real-time student progress
- Conduct live quizzes
- View class analytics and performance charts
- Manage class chat (pin, mute, delete)

### 👤 Admin
- Manage users (students, teachers)
- Configure platform settings
- View platform-wide analytics

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/verify-email` | Verify email format & availability |
| POST | `/api/users/send-otp` | Send OTP to email |
| POST | `/api/users/verify-otp` | Verify OTP code |
| POST | `/api/users/register` | Register with OTP verification |
| POST | `/api/users/login` | Login with credentials |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile |
| PUT | `/api/users/profile` | Update profile |
| GET | `/api/users/:id` | Get user by ID |

### Lessons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lessons` | Get all lessons |
| GET | `/api/lessons/:id` | Get lesson by ID |
| POST | `/api/lessons` | Create lesson (teacher) |
| PUT | `/api/lessons/:id` | Update lesson |
| DELETE | `/api/lessons/:id` | Delete lesson |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/progress` | Update progress |
| GET | `/api/progress/:userId` | Get user progress |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (video/PDF) |
| GET | `/api/upload/status/:filename` | Check compression status |

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Module not found errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**2. MongoDB connection failed**
- Verify MongoDB URI in `.env`
- Check network access in MongoDB Atlas
- Add your IP to whitelist

**3. FFmpeg not found**
```bash
# Verify installation
ffmpeg -version

# macOS: brew install ffmpeg
# Linux: sudo apt-get install ffmpeg
```

**4. Port already in use**
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change PORT in backend/.env
```

**5. CORS errors**
- Ensure `FRONTEND_URL` in backend/.env matches frontend dev server
- Check frontend is running on expected port

**6. Email (Nodemailer) not sending**
- Use app-specific password for Gmail (not regular password)
- Enable "Less secure app access" or use OAuth2
- Verify SMTP settings in `.env`

---

## 📚 Documentation

- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Comprehensive technical documentation
- **[requirements.txt](./requirements.txt)** - Detailed requirements and setup guide
- **`/nabha/`** - SIH2025 project specifications

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Team

**SIH2025 - Problem Statement ID: SIH25019**
Matrusri Engineering College, Team 3

---

## 🙏 Acknowledgments

- Rural students and teachers in Nabha, Punjab
- SIH2025 organizers
- Open-source community

---

<div align="center">

**Built with ❤️ for rural education in India**

🌐 **Vidya Sahayak** - Bridging the digital divide in education

</div>
