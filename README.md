<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Y2eXHmDApz_zMAKpoG1hfVTl03pIhh2E

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and fill in:
   - `GEMINI_API_KEY` – your Gemini API key (server-side only, not exposed to client)
   - `VITE_SUPABASE_URL` – Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` – Supabase anon key (JWT format: `eyJ...`)
3. Run the app:
   - **Full stack (with AI):** `npm run dev:full` or `vercel dev` – runs frontend + API (requires Vercel CLI)
   - **Frontend only:** `npm run dev` – AI features need the API (use `vercel dev` or deploy to Vercel)

**Deploy:** Set `GEMINI_API_KEY` in your Vercel project Environment Variables. The API key is never exposed to the client.
