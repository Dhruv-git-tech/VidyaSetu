# 🔥 Firebase Credentials Setup Guide

## Important Note

**Your app currently works WITHOUT Firebase** using backend OTP authentication.

Firebase is **OPTIONAL** and only needed if you want:
- Firebase user management dashboard
- Firebase email verification links
- Additional Firebase services (Analytics, Cloud Messaging, etc.)

---

## Step-by-Step: Get Firebase Credentials

### Step 1: Create Firebase Project

1. Go to **[Firebase Console](https://console.firebase.google.com)**
2. Sign in with your Google account
3. Click **"Add project"** or **"Create a project"**
4. Enter project name: `Vidya Sahayak`
5. Click **Continue**
6. (Optional) Enable Google Analytics
7. Click **Create project**
8. Wait for project creation, click **Continue**

---

### Step 2: Enable Email/Password Authentication

1. In Firebase Console, click **Authentication** in left sidebar
2. Click **Get started**
3. Click **Sign-in method** tab
4. Find **Email/Password** in the list
5. Click on it
6. Toggle **Enable**
7. Click **Save**

---

### Step 3: Get Backend Credentials (Service Account)

1. Click **Project Settings** (⚙️ gear icon) in left sidebar
2. Scroll down to **"Your apps"** section
3. Click the **</>** (Web) icon to register a web app
4. App nickname: `Vidya Sahayak Backend`
5. Click **Register app**
6. Scroll down to **"Firebase Admin SDK"** section
7. Click **Generate new private key**
8. Download the JSON file
9. Open the JSON file - it contains:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     ...
   }
   ```

---

### Step 4: Update Backend .env

1. Open `/backend/.env`

2. Copy values from the JSON file:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   **Important:** 
   - Keep the quotes around `FIREBASE_PRIVATE_KEY`
   - Keep the `\n` characters in the private key

3. Save the file

---

### Step 5: Restart Backend Server

```bash
cd backend
# Stop current server (Ctrl+C)
npm run dev
```

You should see:
```
✅ Firebase Admin initialized successfully
```

---

## ✅ Verify Setup

### Test 1: Check Backend Console

When backend starts, you should see:
```
✅ Firebase Admin initialized successfully
```

### Test 2: Send OTP

```bash
curl -X POST http://localhost:5001/api/users/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Test 3: Register User

1. Go to frontend registration
2. Enter email → Send OTP
3. Check backend console for OTP
4. Enter OTP → Verify
5. Complete registration

---

## 📊 What Firebase Gives You

After setup, you can:

1. **View Users**: Firebase Console → Authentication → Users
2. **Manage Users**: Disable/delete users from dashboard
3. **Email Verification**: Send Firebase verification emails
4. **Analytics**: Track app usage (if enabled)
5. **Cloud Messaging**: Push notifications (future)

---

## ❌ Skip Firebase (Current Setup)

Your app **works perfectly without Firebase** using:
- ✅ Backend OTP generation
- ✅ MongoDB user storage
- ✅ JWT authentication
- ✅ Local caching for offline access

**No Firebase = No problem!**

---

## 📧 Email Delivery (Optional)

Currently OTPs are logged to console. For **production email delivery**:

### Option 1: Resend (Recommended)
- Free: 100 emails/day
- Get API key: https://resend.com/api-keys
- Add to `/backend/.env`:
  ```env
  RESEND_API_KEY=re_xxxxx
  ```

### Option 2: SendGrid
- Free: 100 emails/day
- Get API key: https://sendgrid.com
- Add to `/backend/.env`:
  ```env
  SENDGRID_API_KEY=SG.xxxxx
  ```

### Option 3: AWS SES
- Pay as you go
- Configure AWS credentials
- Add to `/backend/.env`

---

## 🔧 Troubleshooting

### "Invalid private key"
- Make sure to include quotes around the key
- Keep `\n` characters in the private key
- Copy the entire key including `-----BEGIN PRIVATE KEY-----`

### "Firebase not initialized"
- Check all three env variables are set
- Restart backend server
- Check console for error message

### "Module not found: firebase-admin"
```bash
cd backend
npm install firebase-admin
```

---

## 📞 Need Help?

1. Check Firebase Console: https://console.firebase.google.com
2. Firebase Docs: https://firebase.google.com/docs
3. Backend logs: Check terminal for errors

---

**Your app works without Firebase!** Only set this up if you need Firebase-specific features.
