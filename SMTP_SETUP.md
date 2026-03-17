# SMTP Email Configuration Guide

## Problem
Your terminal shows "SMTP not configured" which means emails are not being sent. You need to configure SMTP in your `.env` file.

## Solution: Configure Gmail SMTP

Since you're using `sysamrocks77@gmail.com` to send emails, here's how to set it up:

### Step 1: Create/Update `.env` file

Create a `.env` file in the `Dermaeasebackend` folder with these SMTP settings:

```env
# SMTP Configuration for Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sysamrocks77@gmail.com
SMTP_PASS=your-app-password-here
FROM_EMAIL=sysamrocks77@gmail.com
```

### Step 2: Get Gmail App Password

Gmail requires an "App Password" (not your regular password) for SMTP:

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** on the left
3. Under "Signing in to Google", enable **2-Step Verification** (if not already enabled)
4. After enabling 2-Step Verification, go back to Security
5. Under "Signing in to Google", click **App passwords**
6. Select "Mail" and "Other (Custom name)" - enter "DermaEase"
7. Click **Generate**
8. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)
9. Paste it in your `.env` file as `SMTP_PASS` (remove spaces)

### Step 3: Restart Your Server

After updating `.env`, restart your backend server:
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### Step 4: Verify Configuration

When you start the server, you should see:
```
✅ SMTP configured (Host: smtp.gmail.com, Port: 587)
```

Instead of:
```
⚠️  SMTP not configured. Missing: SMTP_HOST, SMTP_USER, SMTP_PASS
```

## Alternative: Use a Different Email Service

If you prefer not to use Gmail, you can use:
- **SendGrid**: Free tier available
- **Mailgun**: Free tier available  
- **AWS SES**: Pay-as-you-go
- **Ethereal Email**: For testing (emails don't actually send)

## Testing

After configuration, try registering with a new Gmail account. You should see:
- `📤 Sending email via SMTP:` in the logs
- `✅ Email sent successfully:` with messageId
- Email should appear in your Gmail Sent folder

## Troubleshooting

If emails still don't send:
1. Check that `.env` file is in `Dermaeasebackend` folder (same level as `package.json`)
2. Make sure there are no spaces around `=` in `.env` file
3. Verify App Password is correct (16 characters, no spaces)
4. Check Gmail security settings - make sure "Less secure app access" is not blocking it
5. Check server logs for SMTP error messages

