# 📧 Resend Email Setup Guide (2 Minutes)

Resend is a modern email API that sends real emails for your OTP verification.

**Free Tier:** 100 emails/day, 3,000 emails/month

---

## Quick Setup

### Step 1: Get Resend API Key

1. **Go to Resend**: https://resend.com/api-keys
2. **Sign up** with GitHub or email (free)
3. **Click "Create API Key"**
4. **Name it**: `Vidya Sahayak`
5. **Permission**: Full Access
6. **Click "Create"**
7. **Copy the API key** (starts with `re_`)

### Step 2: Update `.env`

Open `/backend/.env` and paste your API key:

```env
RESEND_API_KEY=re_xxxxx_your_actual_api_key_here
```

### Step 3: Restart Backend

```bash
cd backend
# Press Ctrl+C to stop
npm run dev
```

You should see:
```
✅ Resend email initialized
⚠️  Firebase credentials not configured. Using custom OTP system.
Server running on port 5001
```

---

## ✅ Test Email Delivery

### Method 1: Test via Registration

1. Open your app: http://localhost:5173
2. Click "Sign Up"
3. Enter your **real email address**
4. Click "Send OTP"
5. **Check your email inbox** (and spam folder)
6. You'll receive a beautiful OTP email!

### Method 2: Test via API

```bash
curl -X POST http://localhost:5001/api/users/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "your-real-email@gmail.com"}'
```

Check your inbox for the OTP email.

---

## 📧 Email Template

Your OTP emails will look like this:

```
Subject: Your Vidya Sahayak Verification OTP

🎓 Vidya Sahayak

Your verification code is:

  123456

This code expires in 5 minutes.
Do not share it with anyone.

Vidya Sahayak · Digital Learning Platform
```

With a beautiful purple gradient design and large OTP code display.

---

## 🔧 Troubleshooting

### "Resend API key not configured"

**Solution:** Make sure `RESEND_API_KEY` in `/backend/.env` starts with `re_`

### Email not received

**Solutions:**
1. Check **spam folder**
2. Verify API key is correct
3. Check backend console for errors
4. Resend dashboard shows delivery status: https://resend.com/emails

### "Failed to send email"

**Check:**
- Resend API key is valid
- Internet connection
- Backend console for error details

---

## 📊 Resend Dashboard

View email delivery status, opens, and analytics:
- **Emails**: https://resend.com/emails
- **Settings**: https://resend.com/settings

---

## 🚀 Production Tips

### For Better Deliverability:

1. **Add Custom Domain** (optional)
   - Resend Dashboard → Domains → Add Domain
   - Follow DNS setup instructions
   - Sends from `yourdomain.com` instead of `resend.dev`

2. **Verify Email Templates**
   - Test on multiple email providers
   - Check spam score
   - Add unsubscribe link (for marketing emails)

3. **Monitor Usage**
   - Free tier: 100 emails/day
   - Upgrade if needed: https://resend.com/pricing

---

## 💰 Pricing

- **Free**: 100 emails/day, 3,000/month
- **Pro**: $20/month for higher limits
- **Pay as you go**: $1 per 1,000 emails over limit

Perfect for development and small production use!

---

## 📞 Support

- **Docs**: https://resend.com/docs
- **Dashboard**: https://resend.com
- **Status**: https://status.resend.com

---

**That's it!** Your app now sends real emails for OTP verification. 🎉
