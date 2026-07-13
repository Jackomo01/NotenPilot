#!/usr/bin/env bash
# Setup Checklist für Google Auth mit Firebase
# Benutze diese Checkliste um sicherzustellen, dass alles korrekt konfiguriert ist

## SCHRITT 1: Firebase Projekt Setup
[ ] Firebase Projekt erstellt unter https://console.firebase.google.com/
[ ] Web App in Firebase angelegt
[ ] Firebase Credentials kopiert

## SCHRITT 2: Environment Variables
[ ] `.env.local` Datei im Projektroot erstellt (nicht versionieren!)
[ ] VITE_FIREBASE_API_KEY gesetzt
[ ] VITE_FIREBASE_AUTH_DOMAIN gesetzt
[ ] VITE_FIREBASE_PROJECT_ID gesetzt
[ ] VITE_FIREBASE_STORAGE_BUCKET gesetzt
[ ] VITE_FIREBASE_MESSAGING_SENDER_ID gesetzt
[ ] VITE_FIREBASE_APP_ID gesetzt
[ ] VITE_FIREBASE_MEASUREMENT_ID gesetzt

## SCHRITT 3: Firebase Console Konfiguration
[ ] Google Sign-In in Authentication aktiviert
[ ] Support Email für Google Sign-In gesetzt
[ ] `localhost` zu Authorized Domains hinzugefügt
[ ] Production Domain zu Authorized Domains hinzugefügt (falls vorhanden)

## SCHRITT 4: Lokale Entwicklung
[ ] Development Server mit `npm run dev` gestartet
[ ] App öffnet sich unter http://localhost:5173
[ ] "Mit Google anmelden" Button ist sichtbar

## SCHRITT 5: Test Google Sign-In
[ ] Button angeklickt - Pop-up öffnet sich
[ ] Erfolgreich mit Google Konto angemeldet
[ ] Fehler in Browser Console? → Überprüf Environment Variables
[ ] "Unauthorized domain" Fehler? → Überprüf Authorized Domains in Firebase

## SCHRITT 6: App Funktionalität
[ ] Nach Sign-In zeigt App korrekten Benutzernamen
[ ] App speichert Benutzerdaten korrekt
[ ] Logout Funktion funktioniert (falls implementiert)
[ ] App merkt sich Login State über Seiten-Refresh

## OPTIONAL: Production Setup
[ ] `.env.production.local` mit Production Credentials erstellt
[ ] Production Domain in Firebase Authorized Domains hinzugefügt
[ ] Build getestet: `npm run build && npm run preview`
[ ] Production Domain in Analytics/Monitoring konfiguriert

## TROUBLESHOOTING
Falls etwas nicht funktioniert, überprüfe:

### Pop-up wird nicht angezeigt
- [ ] Pop-ups sind in Browser erlaubt
- [ ] Keine Browser Extensions blockieren Pop-ups
- [ ] Netzwerk Verbindung ist stabil
- [ ] Browser Console zeigt Fehler?

### "Unauthorized domain" Fehler
- [ ] `localhost` ist in Firebase Authorized Domains
- [ ] Falls Production: Production Domain ist hinzugefügt
- [ ] Seite wird über http://localhost:5173 aufgerufen, nicht 127.0.0.1

### "Unknown Error" oder kein Fehler
- [ ] Browser Console überprüfen (F12)
- [ ] Firebase API Key und Credentials überprüfen
- [ ] Google Sign-In in Firebase Authentication aktiviert?
- [ ] .env.local neu laden erforderlich: Dev Server neu starten

### User Daten nicht gespeichert
- [ ] localStorage muss aktiviert sein
- [ ] `useLS()` Hook in App.jsx überprüfen
- [ ] LocalStorage in Browser Console überprüfen: 
  ```javascript
  localStorage.getItem('np6_user')
  ```

## Zusätzliche Ressourcen

- Schnellstart Anleitung: `GOOGLE_AUTH_QUICKSTART.md`
- Detaillierte Dokumentation: `FIREBASE_SETUP_NEW.md`
- Änderungen Übersicht: `CHANGES_SUMMARY.md`
- Firebase Dokumentation: https://firebase.google.com/docs
- Google Sign-In Docs: https://developers.google.com/identity/protocols/oauth2

## Performance Tipps

- Firebase ist optimiert für mobile und web
- Lazy loading der Auth Module reduziert Bundle Size
- Caching erfolgt automatisch durch Firebase SDK
- Session Token wird von Firebase verwaltet

## Sicherheit

⚠️ WICHTIG:
- `.env.local` niemals committen (ist in .gitignore)
- Firebase API Key ist für Web nicht geheim (ist OK)
- Echte Secrets nur in Backend Operationen verwenden
- Firebase Security Rules müssen für Datenbank konfiguriert werden

## Support & Help

Bei Fragen:
1. Browser Console öffnen (F12) und Error Meldungen checken
2. Firebase Console Status überprüfen: https://status.firebase.google.com/
3. Dokumentation nochmal lesen
4. Beim Debugging: .env.local auf korrekten Values überprüfen

Viel Erfolg beim Testen! 🚀

---
Generiert für NotPilot Google Auth Setup
Erstellt: 2026-03-25
