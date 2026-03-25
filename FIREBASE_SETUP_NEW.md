# Firebase & Google Auth Setup Guide

## Prerequisites

You need to have:
- A Firebase project created at https://console.firebase.google.com/
- Google Sign-In enabled in your Firebase project

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

## 3. Firebase Configuration

The app uses Firebase Web SDK which handles Google Sign-In automatically using pop-ups.

### Setup Authorized Domains:
1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your domains:
   - `localhost` (for local development)
   - Your production domain

This is required for the Google Sign-In popup to work.

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
```

## 5. Installation

The following packages are required:

```bash
npm install firebase
```

Firebase package has been installed as a dependency.

## 6. Testing

### Web:
```bash
npm run dev
```
Click the "Mit Google anmelden" button and test the flow.

The pop-up will appear for you to sign in with your Google account.

### Android Build:
For Android builds with Capacitor:
```bash
npm run build
npx cap add android
npx cap open android
# Build and run in Android Studio
```

Note: For Android, you'll need to register your app in Firebase and get `google-services.json`.

## Troubleshooting

### "Unauthorized domain" Error
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add `localhost` for development
- Add your actual domain for production

### Pop-up Not Appearing
- Check if your browser is blocking pop-ups
- Allow pop-ups for your localhost or domain
- Check browser console for specific error messages

### Firebase Config Missing Error
- Create `.env.local` file with all Firebase credentials
- Copy values from Firebase Project Settings
- Restart your development server after adding .env.local

### "Unknown Error" on Sign-In
- Check that Google Sign-In is enabled in Firebase Authentication
- Verify your Firebase project exists and is active
- Check browser console for detailed error

## Security Notes

- **Never commit `.env.local` or any credentials to version control**
- Keys in `.env.local` are available to the browser (not secret)
- Use Firebase Security Rules to protect your data
- Consider implementing custom claims for role-based access

## Production Deployment

When deploying to production:

1. Create `.env.production.local` with your production Firebase credentials
2. Add your production domain to Firebase authorized domains
3. Build your app: `npm run build`
4. Deploy the `dist` folder to your hosting service

Popular options:
- Firebase Hosting
- Vercel
- Netlify
- GitHub Pages
