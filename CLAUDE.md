# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run locally (http://localhost:3000)
node server.js

# Deploy to Vercel production
vercel --prod
```

Requires `ANTHROPIC_API_KEY` in `.env` for local dev. Set the same key in Vercel → Settings → Environment Variables for production.

## Architecture

Single-file Express backend (`server.js`) with a static vanilla JS frontend (`public/`).

**Request flow:**
1. User drops/selects an image in the browser
2. `public/app.js` POSTs it as `multipart/form-data` to `/identify`
3. `server.js` receives the file via multer (memory storage — no disk writes), encodes it as base64, and sends it to Claude (`claude-sonnet-4-6`) with a structured prompt
4. Claude returns a strict JSON response; `server.js` extracts it with a regex and forwards it to the client
5. `public/app.js` populates the results UI from the JSON fields

**Vercel deployment:**
`vercel.json` routes all requests through `server.js` using `@vercel/node`. The app detects serverless vs. local via `require.main === module` — locally it calls `app.listen()`, on Vercel it just exports `app`. Static files must use `path.join(__dirname, 'public')` (not a relative path) to resolve correctly in the serverless environment.

**Claude response schema** (defined in the prompt in `server.js`):
- `common_name`, `species`, `family`, `confidence`, `description`
- `light`: `{ requirement, details }`
- `watering`: `{ frequency, details }`
- `care`: `{ difficulty, temperature, humidity, tips[] }`
- `not_a_plant`: boolean — if true, the frontend shows an error instead of results
