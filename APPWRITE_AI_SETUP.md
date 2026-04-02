# Appwrite AI Backend Setup (Notenpilot)

Diese Anleitung richtet den AI-Endpoint ein, den dein Frontend bereits erwartet.

## 1. Function in Appwrite erstellen

1. In Appwrite: `Functions` -> `Create function`
2. Name: `notenpilot-ai-chat`
3. Runtime: `Node.js 20+`
4. Root directory im Repo: `appwrite/functions/ai-chat`
5. Entrypoint: `src/main.js`
6. Build command: leer lassen

## 2. Umgebungsvariablen in der Function setzen

Setze in der Function folgende Variablen:

- `LLM_API_KEY` = dein Provider-Key
- `LLM_BASE_URL` = `https://openrouter.ai/api/v1` (oder OpenAI-kompatibler Endpoint)
- `LLM_MODEL` = `nvidia/nemotron-3-super-120b-a12b:free` (empfohlen)
- `LLM_HTTP_REFERER` = deine App-URL (z.B. `https://notenpilot.app`)
- `LLM_APP_TITLE` = `Notenpilot`

Wichtig fuer Free-Modelle bei OpenRouter:
- Free-Endpunkte koennen Prompts/Outputs zu Produktverbesserung loggen.
- Keine persoenlichen, vertraulichen oder sensiblen Daten senden.
- Fuer Produktion besser ein kostenpflichtiges Modell oder eigener Host.

Hinweis: Wenn du OpenAI statt OpenRouter nutzt, setze `LLM_BASE_URL` auf deinen OpenAI-kompatiblen Endpoint.

## 3. Berechtigungen

- Frontend muss die Function aufrufen duerfen.
- Stelle die Function-Permissions so ein, dass deine App-User sie ausfuehren koennen.

## 4. Endpoint-URL in Frontend setzen

Lege lokal eine `.env` (oder `.env.local`) im Projektroot an:

```env
VITE_AI_PROVIDER=appwrite
VITE_AI_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1/functions/<FUNCTION_ID>/executions
VITE_AI_API_KEY=

# Optional: alte Variablennamen bleiben kompatibel
VITE_APPWRITE_AI_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1/functions/<FUNCTION_ID>/executions
VITE_APPWRITE_AI_API_KEY=
```

Wichtig:
- Falls du die Function clientseitig mit Session/JWT aufrufst, bleibt `VITE_APPWRITE_AI_API_KEY` leer.
- Falls du explizit einen API-Key im Header `x-api-key` brauchst, trage ihn ein.

## 5. Testen

1. App starten: `npm run dev`
2. In der Suchleiste eine AI-Frage stellen
3. Oder im AI-Tab Chat nutzen
4. Wenn Appwrite nicht erreichbar ist, faellt das Frontend automatisch auf lokale AI/Fallback zurueck

## 6. Beispiel-Request (was Frontend sendet)

```json
{
  "mode": "chat",
  "prompt": "Analysiere meine Ausfragen",
  "context": {
    "average": 2.8,
    "grades": [
      { "subject": "Mathe", "grade": 4, "date": "2026-03-10", "type": "Ausfrage" }
    ]
  },
  "history": [
    { "role": "user", "text": "Wie ist mein Schnitt?" }
  ]
}
```

## 7. Beispiel-Response (was Frontend erwartet)

```json
{
  "answer": "Deine Ausfragen liegen aktuell bei ..."
}
```
