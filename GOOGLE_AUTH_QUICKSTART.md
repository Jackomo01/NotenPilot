# Google Auth mit Firebase - Schnellstart

Firebase Google Authentication wurde erfolgreich integriert! Hier sind die nächsten Schritte:

## Das wurde gemacht:

✅ Firebase Package installiert  
✅ Firebase Konfigurationsdatei erstellt (`src/config/firebase.js`)  
✅ Firebase Utility Modul erstellt (`src/utils/firebase.js`)  
✅ AuthPage.jsx aktualisiert mit echtem Google Sign-In  
✅ Dokumentation erstellt  

## Nächste Schritte:

### 1. Firebase Projekt erstellen
- Gehe zu https://console.firebase.google.com/
- Erstelle ein neues Projekt oder wähle ein existierendes aus
- Erstelle eine Web-App in deinem Firebase Projekt

### 2. Firebase Credentials kopieren
- Gehe zu Project Settings (Zahnradsymbol)
- Scrolle zu "Your apps" 
- Kopiere die Konfiguration deiner Web-App
- Erstelle eine `.env.local` Datei im Projektroot mit:

```env
VITE_FIREBASE_API_KEY=dein_api_key
VITE_FIREBASE_AUTH_DOMAIN=dein_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dein_project_id
VITE_FIREBASE_STORAGE_BUCKET=dein_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=dein_messaging_id
VITE_FIREBASE_APP_ID=dein_app_id
VITE_FIREBASE_MEASUREMENT_ID=dein_measurement_id
```

### 3. Google Sign-In in Firebase aktivieren
- In der Firebase Console gehe zu **Authentication**
- Klick auf **Sign-in method**
- Aktiviere **Google**
- Wähle deine Support Email aus
- Speichern

### 4. Autorisierte Domains hinzufügen
- In Firebase Console: **Authentication** → **Settings** → **Authorized domains**
- Füge hinzu:
  - `localhost` (für lokale Entwicklung)
  - Deine Production Domain

### 5. Testen
```bash
npm run dev
```
Öffne http://localhost:5173 und klick auf "Mit Google anmelden"

## Dateistruktur:

```
src/
├── config/
│   └── firebase.js          # Firebase Konfiguration
├── utils/
│   └── firebase.js          # Firebase Auth Funktionen
└── pages/
    └── AuthPage.jsx         # Aktualisiert mit Google Auth
```

## Wichtige Funktionen in `src/utils/firebase.js`:

- `signInWithGoogle()` - Google Sign-In mit Firebase
- `signOutUser()` - Benutzer abmelden
- `getCurrentUser()` - Aktuellen Benutzer abrufen
- `onAuthStateChanged()` - Auth State Änderungen überwachen
- `initializeGoogleAuth()` - Auth initialisieren

## Fehlerbehandlung:

Das System zeigt automaitsch Fehlermeldungen:
- "Pop-up wurden blockiert" - Pop-ups müssen erlaubt sein
- "Netzwerkfehler" - Internet Verbindung prüfen
- "Autorisierte Domain" - Domain in Firebase hinzufügen

## Environment Datei (.env.local):

⚠️ **WICHTIG:**
- Diese Datei ist in `.gitignore` und wird nicht versioniert
- Teile diese Datei niemals
- Sie ist geheim und persönlich

## Weitere Ressourcen:

- Detaillierte Dokumentation: `FIREBASE_SETUP_NEW.md`
- Firebase Docs: https://firebase.google.com/docs
- Google Auth Docs: https://developers.google.com/identity/protocols/oauth2

## Troubleshooting:

Falls etwas nicht funktioniert:

1. **Überprüfe .env.local** - Alle Werte vorhanden?
2. **Firebase Console** - Sind Google Sign-In aktiv?
3. **Browser Console** - Welche Fehlermeldung zeigt sich?
4. **Pop-ups erlaubt** - Sind Pop-ups für deine Domain erlaubt?
5. **Authorized Domains** - Localhost/Domain hinzugefügt?

Viel Erfolg! 🚀
