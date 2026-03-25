# Firebase & Google Auth Setup Guide

## Prerequisites

You need to have:
- A Firebase project created at https://console.firebase.google.com/
- Google OAuth 2.0 credentials configured in Google Cloud Console
- Android app registered in Firebase (for native builds)

## 1. Firebase Setup

### Create Firebase Project:
1. Go to https://console.firebase.google.com/
2. Click "Add project" and follow the wizard
3. Enable "Google Analytics" (optional but recommended)
4. Create a new Web app in your Firebase project

### Get Firebase Credentials:
1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Select your Web app
4. Copy the config object
5. Create a `.env.local` file in your project root with these values:

```
VITE_FIREBASE_API_KEY=your_value
VITE_FIREBASE_AUTH_DOMAIN=your_value
VITE_FIREBASE_PROJECT_ID=your_value
VITE_FIREBASE_STORAGE_BUCKET=your_value
VITE_FIREBASE_MESSAGING_SENDER_ID=your_value
VITE_FIREBASE_APP_ID=your_value
VITE_FIREBASE_MEASUREMENT_ID=your_value
```

## 2. Enable Google Sign-In in Firebase

1. In Firebase Console, go to **Authentication**
2. Click **Sign-in method**
3. Click **Google**
4. Toggle it ON
5. Select your **Support email** from dropdown
6. Save

## 3. Google OAuth Configuration

### For Web:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **OAuth 2.0 Client IDs**
4. Create/select a Web application credential
5. Add authorized redirect URIs:
   - `http://localhost:5173/` (for local development with Vite)
   - `http://localhost:4173/` (for preview build)
   - Your production domain

6. Copy the **Client ID** and set:
```
VITE_GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### For Android:
1. In Firebase Console, register your Android app
2. Download `google-services.json` and place it in `android/app/`
3. In Google Cloud Console, create an Android OAuth 2.0 credential:
   - Package name: `com.jakob.notenpilot` (from your AndroidManifest.xml)
   - SHA-1 fingerprint: Get this from your keystore:
   ```bash
   cd android
   ./gradlew signingReport
   ```
   - Copy the SHA-1 from the output

4. Update `package.json` scripts to match your setup

## 4. Environment File

Create `.env.local` in project root (this file is in .gitignore, keep it secret):

```env
VITE_FIREBASE_API_KEY=xxxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxxx
VITE_FIREBASE_PROJECT_ID=xxxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxx
VITE_FIREBASE_APP_ID=xxxxx
VITE_FIREBASE_MEASUREMENT_ID=xxxxx
VITE_GOOGLE_OAUTH_CLIENT_ID=xxxxx
```

## 5. Installation

The following packages are required:

```bash
npm install firebase @capacitor/google-auth
```

## 6. Testing

### Web:
```bash
npm run dev
```
Click the "Mit Google anmelden" button and test the flow.

### Android:
```bash
npm run build
npx cap add android
npx cap open android
# Build and run in Android Studio
```

## Troubleshooting

### "Invalid Client" Error
- Make sure your Firebase project ID and OAuth Client ID match
- Check that your redirect URIs are correctly configured in Google Cloud Console
- Verify the Client ID is for the correct platform (Web for web, Android for Android)

### Google Auth Not Initializing
- Ensure OAuth Client ID is set correctly in environment variables
- Check browser console for specific error messages
- Verify that SignIn is enabled in Firebase

### Android Issues
- Ensure SHA-1 fingerprint is registered in Google Cloud Console
- Verify package name matches in AndroidManifest.xml
- Check that google-services.json is in android/app/

## Security Notes

- **Never commit `.env.local` or any credentials to version control**
- Keys in `.env.local` are used only during build/development
- For sensitive operations, use Firebase Security Rules
- Implement custom claims for role-based access if needed
