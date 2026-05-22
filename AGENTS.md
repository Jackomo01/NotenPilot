# AGENTS.md — Agent instructions for this repository

Purpose
- Give concise, actionable guidance for AI coding agents working in this workspace.

Quick dev commands
- Install deps: `npm install`
- Run web dev: `npm run dev`
- Build web: `npm run build`
- Lint: `npm run lint`
- Run AI proxy: `npm run ai:proxy`

Important locations
- `package.json`: [package.json](package.json)
- Web app source: [src/](src/)
- Expo/mobile app: [NotenPilotExpo/](NotenPilotExpo/)
- Capacitor Android project: [android/](android/)
- Server / proxy: [server/openrouter-proxy.mjs](server/openrouter-proxy.mjs)
- Appwrite functions: [appwrite/functions/ai-chat/](appwrite/functions/ai-chat/)
- Project docs and setup guides: [FIREBASE_SETUP.md](FIREBASE_SETUP.md), [APPWRITE_AI_SETUP.md](APPWRITE_AI_SETUP.md), [SETUP_CHECKLIST.sh](SETUP_CHECKLIST.sh), [README.md](README.md)

Agent guidance
- Link, don't duplicate: prefer referencing files above rather than copying long docs.
- Discoverability: inspect `package.json` scripts and `vite.config.js` for build/runtime behavior.
- Environment & secrets: consult `FIREBASE_SETUP.md` and `APPWRITE_AI_SETUP.md` before changing authentication or cloud functions.
- Mobile vs Web: this repo contains both a web app (`src/`) and an Expo app (`NotenPilotExpo/`). Confirm target before editing.
- Android builds: modifications under `android/` affect native Capacitor builds—avoid changes without testing.
- AI proxy: the `ai:proxy` script runs `server/openrouter-proxy.mjs` — check it when debugging AI requests.
- Tests: no test harness detected; add tests in `package.json` if needed.

Recommended follow-ups
- Add a `.github/copilot-instructions.md` with role-specific guidance (frontend/backend/mobile).
- Create small skills for common tasks: `format`, `lint-fix`, `build-and-preview`.

If you want, I can create the suggested `.github/copilot-instructions.md` or add skills next.