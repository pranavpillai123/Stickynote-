# StickyBoard — How to Authenticate (Login & Registration)

This guide explains how the authentication flow (registering, getting OTPs, and logging in) works in StickyBoard, along with the steps to run it.

---

## Prerequisite: Database Configuration
Since StickyBoard now uses PostgreSQL, you must have a database connection string configured in your [.env](file:///c:/Users/prana/Desktop/stickynote/Stickynote-/.env) file:
```env
DATABASE_URL=postgresql://your_neon_username:your_neon_password@ep-your-neon-host.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## Step 1: Start the Application
To run the server and front-end:
1. Double-click the **`run.bat`** file in your project folder, or run this command in your terminal:
   ```bash
   venv\Scripts\python.exe server.py
   ```
2. Open your web browser and navigate to: **`http://localhost:5000`**

---

## Step 2: Creating a New Account (Registration)
1. On the login screen, click **"Create one"** under the sign-in button.
2. Fill out the registration form:
   * **Username:** Choose a username (minimum 3 characters).
   * **Email:** *(Optional)* Enter your email address to receive email OTPs/reminders.
   * **Phone Number:** *(Optional)* Enter your mobile number with country code (e.g. `+91XXXXXXXXXX`) to receive WhatsApp OTPs/reminders.
     *(Note: You must provide at least one contact method—either Email or Phone).*
   * **Password:** Choose a password (minimum 6 characters).
3. Click **"Create Account"**.
4. A prompt will ask where you'd like to receive reminders (WhatsApp, Email, or Both). Select your preference.

---

## Step 3: Verifying your Account (OTP)
1. Once you click submit, the app will generate a 6-digit One-Time Password (OTP) and deliver it:
   * **If Twilio/SMTP is configured:** Check your mobile WhatsApp messages or your email inbox (and Spam folder).
   * **If Twilio/SMTP is NOT configured (Offline/Fallback):** Look at your Python server console window. The app will log the OTP there, saying:
     `[OTP Fallback] SMTP failed/not configured. Email OTP for user@example.com is: XXXXXX`
2. You will be redirected to the **Verify OTP** page in your browser.
3. Enter the 6-digit OTP code and click **"Verify"**.
4. Upon successful verification, your account is saved to the database, and you will be redirected straight to your dashboard!

---

## Step 4: Subsequent Logins (Sign In)
Once registered:
1. Go to **`http://localhost:5000`**.
2. Under **"Username or Email"**, enter either the username or email you registered with.
3. Enter your **Password**.
4. Click **"Sign In"**. You will be authenticated immediately without needing another OTP.
