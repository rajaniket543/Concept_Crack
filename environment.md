# Render Deployment — Environment Setup

## Service Type
**Static Site** (React SPA — no Node server needed for the main app)

> The app uses Firebase Auth + Firestore directly from the browser.
> The Express backend (`server/`) is legacy and not required for the live product.

---

## Build & Deploy Settings (Render Dashboard)

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Node Version** | `18` or higher |

---

## Environment Variables (Render → Environment tab)

### Required

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `VITE_GEMINI_API_KEY` | `your-gemini-key` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — free |

### Already hardcoded (no env var needed)

Firebase config is hardcoded in `src/lib/firebase.ts` — public keys by design, safe to ship in frontend code.

| Config Key | Value |
|------------|-------|
| `apiKey` | `AIzaSyAh6QgSH9Y3Fp_wR_KMYrWVaNlshZj8ChM` |
| `authDomain` | `concept-crack.firebaseapp.com` |
| `projectId` | `concept-crack` |
| `storageBucket` | `concept-crack.firebasestorage.app` |
| `appId` | `1:844804621506:web:d6edda6a9c40f62a80e75b` |

---

## If You Also Deploy the Express Backend

Only needed if you use the legacy REST API (`/api/*` routes).
Add a second Render service of type **Web Service**.

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/server/index.js` |
| **Port** | `8787` (or let Render assign via `PORT`) |

### Additional Backend Env Vars

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required — enables SSL for DB |
| `DATABASE_URL` | `postgresql://...` | Auto-set by Render PostgreSQL add-on |
| `PORT` | _(leave blank)_ | Render sets this automatically |
| `REDIS_URL` | `redis://...` | Only if using Render Redis add-on |

---

## Firebase Console — Required Settings

1. **Authentication → Settings → Authorized domains**
   Add your Render domain: `your-app.onrender.com`

2. **Firestore → Rules**
   Make sure rules allow authenticated reads/writes (already configured).

---

## Deployment Steps

1. Push `dev` branch to GitHub (already done)
2. Go to [render.com](https://render.com) → New → **Static Site**
3. Connect your GitHub repo → select `dev` branch
4. Set Build Command: `npm install && npm run build`
5. Set Publish Directory: `dist`
6. Add environment variable: `VITE_GEMINI_API_KEY = <your key>`
7. Click **Deploy**
8. After deploy, copy the live URL → add it to Firebase Console → Authentication → Authorized domains
