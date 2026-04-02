# OpenRouter Setup ohne Appwrite

Diese Variante nutzt einen kleinen lokalen Proxy aus dem Repo.

## 1. OpenRouter Key setzen (Server-seitig)

PowerShell (im Projektordner):

```powershell
$env:OPENROUTER_API_KEY = "<DEIN_OPENROUTER_KEY>"
$env:OPENROUTER_MODEL = "qwen/qwen3.6-plus:free"
$env:OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
$env:OPENROUTER_HTTP_REFERER = "http://localhost:5173"
$env:OPENROUTER_APP_TITLE = "NotenPilot"
```

Wichtig: Den Key nie in `VITE_...` Variablen speichern.

Wichtig: Diese Variablen gelten nur fuer das aktuelle Terminal.
Starte `npm run ai:proxy` im selben Terminal, in dem du `$env:OPENROUTER_API_KEY` gesetzt hast.
Wenn du ein neues Terminal oeffnest, musst du die `$env:...` Variablen dort erneut setzen.

Alternative ohne Terminal-Variablen:
- Trage die Werte als normale (nicht-`VITE_`) Eintraege in `.env.local` ein.
- Der Proxy liest `.env.local` automatisch beim Start.

Beispiel in `.env.local`:

```env
OPENROUTER_API_KEY=<DEIN_OPENROUTER_KEY>
OPENROUTER_MODEL=qwen/qwen3.6-plus:free
OPENROUTER_FALLBACK_MODEL=openrouter/auto
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_TITLE=NotenPilot
```

## 2. Frontend auf Backend-Provider stellen

In `.env.local`:

```env
VITE_AI_PROVIDER=backend
VITE_AI_ENDPOINT=http://localhost:8787/ai
VITE_AI_ALLOW_RULE_FALLBACK=false
```

## 3. Zwei Prozesse starten

Terminal 1 (Proxy):

```powershell
npm run ai:proxy
```

Direkt danach sollte in diesem Terminal stehen:

```text
OpenRouter proxy listening on http://localhost:8787/ai
```

Terminal 2 (App):

```powershell
npm run dev
```

## 4. Test

- Quick Ask in der Suche testen.
- AI-Tab öffnen und Chat testen.

Optionaler Proxy-Schnelltest (PowerShell):

```powershell
$payload = @{ mode = 'quick'; prompt = 'Wie ist mein Schnitt?'; context = @{}; history = @() } | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri 'http://localhost:8787/ai' -Method POST -ContentType 'application/json' -Body $payload
```

## Hinweis zu Free-Modellen

Bei Free-Endpunkten können Prompts/Outputs geloggt werden. Keine sensiblen Daten senden.
