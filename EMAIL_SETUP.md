# 📧 Email OTP Setup Guide

## ✅ What's Already Implemented

The backend is configured to send OTP emails using **Nodemailer + Gmail SMTP**:

1. ✅ **OTP Generation** - 6-digit code generated
2. ✅ **Database Storage** - Saved in MongoDB with 5-minute expiry
3. ✅ **Email Sending** - Beautiful HTML email via Gmail SMTP
4. ✅ **Console Fallback** - OTP shown in terminal if email fails

---

## 🔧 Setup Steps

### Step 1: Enable 2-Factor Authentication on Gmail

1. Go to [Google Account](https://myaccount.google.com/)
2. Click **Security** in the left sidebar
3. Under "How you sign in to Google", click **2-Step Verification**
4. Follow the steps to enable it

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. If prompted, sign in again
3. Under "App passwords":
   - Select app: **Mail**
   - Select device: **Other (Custom name)** → Enter "Vidya Sahayak"
4. Click **Generate**
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

> ⚠️ **Important**: This is NOT your regular Gmail password. It's a special app password.

### Step 3: Update `.env` File

Open `backend/.env` and update:

```env
EMAIL_USER=sanjaysamala4100@gmail.com
EMAIL_PASS=abcdefghijklmnop  # Your 16-char app password (no spaces)
EMAIL_FROM=Vidya Sahayak <sanjaysamala4100@gmail.com>
```

> 📝 **Note**: Remove spaces from the app password when adding to `.env`

### Step 4: Restart Backend

```bash
cd backend
npm run dev
```

You should see:
```
✅ Email (Nodemailer) initialized
✅ Firebase Admin initialized successfully
```

---

## 🧪 Testing

1. Start the backend server
2. Go to frontend signup page
3. Enter email: `test@example.com`
4. Click **"Send OTP"**
5. Check email inbox - you'll receive:

```
Subject: Your Vidya Sahayak Verification OTP

🎓 Vidya Sahayak
Your verification code is:

123456

This code expires in 5 minutes.
Do not share it with anyone.
```

6. Enter the OTP in the form
7. Complete registration! ✅

---

## 🔍 Troubleshooting

### "Invalid App Password"
- Make sure you copied the password correctly (no spaces)
- Regenerate the app password if needed

### "Email not sending"
- Check backend console for error messages
- Verify 2FA is enabled on your Gmail account
- Make sure "Less secure app access" is not required (using App Password bypasses this)

### "OTP only showing in console"
- Email credentials not configured in `.env`
- Check that `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` are set

---

## 📊 How It Works

```
User Request → Backend
     ↓
Generate 6-digit OTP
     ↓
Save to MongoDB (5 min expiry)
     ↓
Send Email via Gmail SMTP
     ↓
User receives email ✅
```

**Database Schema:**
```javascript
{
  email: "user@example.com",
  otp: "123456",
  expiresAt: Date (5 minutes from now),
  attempts: 0,
  verified: false
}
```

---

## 🎯 Features

- ✅ 6-digit OTP generation
- ✅ 5-minute expiry
- ✅ Maximum 3 verification attempts
- ✅ Beautiful HTML email template
- ✅ Console fallback for development
- ✅ Rate limiting support
- ✅ Class 4-12 student registration
- ✅ Teacher registration with subject

---

## 📦 Dependencies

```json
{
  "nodemailer": "^6.9.0",
  "firebase-admin": "^13.7.0",
  "mongoose": "^8.10.1"
}
```

---

## 🔐 Security Notes

- Never commit `.env` file to Git
- Keep your App Password secret
- OTP codes are hashed in production (optional enhancement)
- Rate limiting prevents brute force attacks

---

**Need Help?** Check the backend console for detailed error messages! 🚀
