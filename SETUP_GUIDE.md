# SyncJam - Setup Guide

## 📋 Prerequisites

- Node.js v20.17.0+ (you have: v20.17.0 ✓)
- npm v10.8.2+ (you have: v10.8.2 ✓)
- A Spotify account (Premium for host users)

---

## 🔑 Step 1: Create Supabase Project (FREE)

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"** (sign up with GitHub/Google)
3. Create a **new organization** (any name)
4. Create a **new project**:
   - **Name:** `SyncJam`
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to you
   - **Pricing Plan:** FREE tier (2 projects, 500MB DB, Realtime included)

5. Once created, go to **Settings** → **API**:
   - Copy `Project URL` → paste in `.env` as `SUPABASE_URL`
   - Copy `anon/public key` → paste in `.env` as `SUPABASE_ANON_KEY`

---

## 🎵 Step 2: Create Spotify Developer App (FREE)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the form:
   - **App name:** `SyncJam`
   - **App description:** `A collaborative listening experience that allows groups to listen to music together in real-time with synchronized playback across devices`
   - **Website:** `http://localhost:5173` (for now)
   - **Redirect URIs:** `http://localhost:5173/callback` ⚠️ IMPORTANT!
   - **APIs used:** Check **Web Playback SDK** and **Web API**
   - Accept Terms of Service

5. Once created:
   - Copy `Client ID` → paste in `.env` as `VITE_SPOTIFY_CLIENT_ID`
   - Click **"Show Client Secret"** → Copy it → paste in `.env` as `VITE_SPOTIFY_CLIENT_SECRET`

6. **Add test users** (Development Mode limit: 25 users):
   - In your app dashboard, go to **Settings** → **User Management**
   - Add email addresses of users who will test the app

---

## 🚀 Step 3: Setup Vercel (FREE - for deployment)

⚠️ **You can skip this for now** - only needed when deploying to production.

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. When ready to deploy, connect this repository

**Free tier includes:**
- 150,000 function invocations/month
- 100GB bandwidth
- Perfect for serverless functions in `/api` folder

---

## ⚙️ Step 4: Configure Environment Variables

1. Open the `.env` file in the project root
2. Fill in the values you copied from Supabase and Spotify:

```env
# Spotify API Configuration
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Vercel Serverless Functions (Backend)
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Environment
APP_ENV=development
```

---

## 📦 Step 5: Install Dependencies & Run

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

The app will be available at: **http://localhost:5173**

---

## 🗂️ Project Structure

```
syncjam/
├── api/                    # Vercel serverless functions
│   ├── auth/              # Spotify OAuth token exchange
│   ├── spotify/           # Proxy for Spotify API calls
│   └── supabase/          # Database operations
├── src/
│   ├── components/
│   │   ├── auth/         # Login, OAuth callback
│   │   ├── room/         # RoomCreation, RoomJoin, GuestList
│   │   ├── player/       # PlaybackControls, Queue, SyncStatus
│   │   └── common/       # Reusable UI components
│   ├── lib/
│   │   ├── spotify/      # Web Playback SDK wrapper
│   │   ├── supabase/     # Supabase client + Realtime
│   │   └── webrtc/       # Audio streaming for non-Premium guests
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript interfaces
│   └── styles/           # Global CSS
├── migrations/            # Supabase database migrations
└── VISION_AND_TASKS.md   # Project roadmap

```

---

## ✅ Verify Setup

Run this checklist:

- [ ] `.env` file has all values filled (except VITE_SPOTIFY_CLIENT_SECRET stays secure)
- [ ] `http://localhost:5173/callback` is added to Spotify Redirect URIs
- [ ] Test users added to Spotify app in Development Mode
- [ ] `npm run dev` starts without errors
- [ ] Can access http://localhost:5173

---

## 🐛 Troubleshooting

### "Invalid redirect URI"
→ Make sure `http://localhost:5173/callback` is **exactly** added in Spotify Dashboard

### "Invalid project URL" (Supabase)
→ URL should start with `https://` and end with `.supabase.co`

### Node.js version warnings
→ Your version (v20.17.0) is compatible but slightly old. Upgrade to v20.19.0+ if you encounter issues

---

## 📚 Next Steps

Once setup is complete, refer to **VISION_AND_TASKS.md** for the implementation roadmap.

**First epic to implement:** A1 - Create repo skeleton (✓ Done!)

**Next epic:** A2 - Spotify OAuth flow (see VISION_AND_TASKS.md for details)
