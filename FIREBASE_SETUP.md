# Firebase Authentication Setup Guide

This guide will help you set up Firebase Email Authentication for Vidya Sahayak.

---

## 📋 Step 1: Create Firebase Project

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click "Add project" or "Create a project"
   - Project name: `Vidya Sahayak` (or your preferred name)
   - Enable Google Analytics (optional)
   - Click "Create project"

---

## 📋 Step 2: Enable Email/Password Authentication

1. **Go to Authentication**
   - In the Firebase Console, click "Authentication" in the left sidebar
   - Click "Get started"

2. **Enable Email/Password Sign-in**
   - Click on the "Sign-in method" tab
   - Find "Email/Password" in the list
   - Click on it and toggle **Enable**
   - Click "Save"

---

## 📋 Step 3: Add Web App to Firebase

1. **Register Web App**
   - Go to Project Settings (gear icon ⚙️)
   - Scroll down to "Your apps"
   - Click the web icon `</>` (Add app)
   - App nickname: `Vidya Sahayak Web`
   - Click "Register app"

2. **Copy Firebase Config**
   - You'll see a configuration object like:
   ```javascript
   const firebaseConfig = {
       apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abc123def456",
       measurementId: "G-XXXXXXXXXX"
   };
   ```

---

## 📋 Step 4: Configure Frontend .env

1. **Open `/frontend/.env`**

2. **Paste your Firebase config:**
   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

3. **Save the file**

4. **Restart frontend dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📋 Step 5: Configure Backend (Optional - for Admin features)

If you want Firebase Admin SDK features in the backend:

1. **Generate Service Account Key**
   - Go to Project Settings ⚙️
   - Click "Service accounts" tab
   - Click "Generate new private key"
   - Download the JSON file

2. **Update `/backend/.env`:**
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ..."
   ```

---

## 📋 Step 6: Test Firebase Authentication

### Test in Browser Console

1. **Open your app** (http://localhost:5173)
2. **Open DevTools** (F12)
3. **Check console** for:
   ```
   ✅ Firebase initialized successfully
   ```

### Test Registration Flow

1. **Go to Sign Up**
2. **Enter email** → Click "Send OTP"
3. **Check email inbox** for OTP
4. **Enter OTP** → Click "Verify OTP"
5. **Complete registration** with name and password

### Test Login Flow

1. **Go to Sign In**
2. **Enter email and password**
3. **Click "Sign In"**
4. **Should redirect** to dashboard

---

## 🔧 Troubleshooting

### "Firebase not configured" message

**Solution:** Make sure `.env` file is in `/frontend/` directory (not `/frontend/src/`)

```
frontend/
├── .env          ← Should be here
├── src/
└── package.json
```

### "Module not found: firebase"

**Solution:** Reinstall Firebase
```bash
cd frontend
npm install firebase --legacy-peer-deps
```

### Email verification not working

**Solution:** Check Firebase Console → Authentication → Templates
- Ensure email template is enabled
- Check spam folder

### CORS errors

**Solution:** Add your frontend URL to Firebase Console
- Project Settings ⚙️
- Authorized domains
- Add: `localhost` (for development)

---

## 📧 Email OTP Flow

### Current Implementation (Hybrid)

```
User enters email
    ↓
Backend generates OTP
    ↓
OTP stored in MongoDB
    ↓
User receives OTP (email service pending)
    ↓
User enters OTP
    ↓
Backend verifies OTP
    ↓
User completes registration
    ↓
(Optional) Firebase user created
```

### Future: Full Firebase Flow

```
User enters email
    ↓
Firebase sends verification email
    ↓
User clicks verification link
    ↓
Email marked as verified in Firebase
    ↓
User sets password
    ↓
Firebase user created
    ↓
MongoDB user created
```

---

## 🚀 Production Checklist

- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Web app registered in Firebase
- [ ] Frontend `.env` configured with Firebase credentials
- [ ] Backend `.env` configured (optional)
- [ ] Email templates customized in Firebase Console
- [ ] Authorized domains configured
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test password reset
- [ ] Test email verification

---

## 📚 Additional Resources

- **Firebase Docs**: https://firebase.google.com/docs/auth
- **Firebase Console**: https://console.firebase.google.com
- **Email Templates**: Firebase Console → Authentication → Templates
- **Firebase Pricing**: https://firebase.google.com/pricing

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use environment variables** for all sensitive data
3. **Enable App Check** in production
4. **Set up reCAPTCHA** for abuse protection
5. **Monitor usage** in Firebase Console

---

## 📞 Support

For issues or questions:
- Check Firebase Console logs
- Review browser console errors
- Verify `.env` configuration
- Restart dev servers after changes

---

**Last Updated**: March 2026
**Version**: 1.0
