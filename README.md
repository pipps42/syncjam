# 🎵 SyncJam

**Listen together, stay in sync** - A real-time collaborative music listening platform powered by Spotify.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-19.1-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Features

- 🎧 **Synchronized Playback** - Everyone hears the same thing at the same time
- 👥 **Room-based Sessions** - Create or join rooms with unique codes
- 🔊 **WebRTC Audio Streaming** - Non-Premium guests can listen via host's stream (CORE FEATURE)
- 🎵 **Spotify Integration** - Full Web Playback SDK support for Premium users
- 📱 **Mobile-First Design** - Optimized for all devices
- ⚡ **Real-time Sync** - Powered by Supabase Realtime

---

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite |
| **Routing** | React Router 7 |
| **Backend** | Vercel Serverless Functions |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **Authentication** | Spotify OAuth 2.0 |
| **Audio Streaming** | WebRTC + Spotify Web Playback SDK |
| **Deployment** | Vercel |

---

## 🎯 Current Status

### ✅ Completed Epics

- **Epic A1:** Repository skeleton and project setup
- **Epic A2:** Spotify OAuth authentication flow

### 🚧 In Progress

- **Epic A3:** Room creation and joining (Next)

### 📅 Upcoming

- **Epic B:** Spotify Web Playback SDK integration
- **Epic C:** Playback controls and synchronization
- **Epic D:** WebRTC audio streaming for non-Premium users

See [VISION_AND_TASKS.md](./VISION_AND_TASKS.md) for the complete roadmap.

---

## 🛠️ Setup & Installation

### Prerequisites

- Node.js v20.17.0+
- npm v10.8.2+
- Spotify account (Premium required for hosts)
- Supabase account (free tier)
- Vercel account (free tier, for deployment)

### Quick Start

1. **Clone and install:**
   ```bash
   git clone <your-repo>
   cd syncjam
   npm install
   ```

2. **Setup API keys:**
   - Follow the detailed guide in [SETUP_GUIDE.md](./SETUP_GUIDE.md)
   - Create Supabase project
   - Create Spotify Developer app
   - Fill in `.env` file

3. **Run database migrations:**
   - Open [Supabase SQL Editor](https://supabase.com/dashboard)
   - Execute `migrations/001_create_auth_sessions.sql`

4. **Start development server:**
   ```bash
   # Option 1: Frontend only
   npm run dev

   # Option 2: Full stack with serverless functions
   npm install -g vercel
   vercel dev
   ```

5. **Open in browser:**
   - http://localhost:5173 (frontend only)
   - http://localhost:3000 (with Vercel dev)

---

## 📁 Project Structure

```
syncjam/
├── api/                          # Vercel serverless functions
│   └── auth/
│       ├── callback.ts          # OAuth token exchange
│       └── refresh.ts           # Token refresh
│
├── src/
│   ├── components/
│   │   └── auth/
│   │       ├── Login.tsx        # Login screen
│   │       └── OAuthCallback.tsx # OAuth callback handler
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   │
│   ├── lib/
│   │   ├── spotify/
│   │   │   └── oauth.ts         # Spotify OAuth utilities
│   │   └── supabase/
│   │       └── client.ts        # Supabase client config
│   │
│   ├── types/
│   │   └── auth.ts              # TypeScript type definitions
│   │
│   └── App.tsx                  # Main app with routing
│
├── migrations/                   # Supabase SQL migrations
│   └── 001_create_auth_sessions.sql
│
├── .env.example                 # Environment variables template
├── SETUP_GUIDE.md              # Detailed setup instructions
├── VISION_AND_TASKS.md         # Project roadmap
├── PROJECT_STATUS.md           # Current progress
└── EPIC_A2_COMPLETE.md         # OAuth implementation details
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Spotify API
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend only (not exposed to frontend)
VITE_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for how to obtain these keys.

---

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

### Lint Code
```bash
npm run lint
```

---

## 📖 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Step-by-step setup instructions
- **[VISION_AND_TASKS.md](./VISION_AND_TASKS.md)** - Complete project roadmap
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Current implementation status
- **[EPIC_A2_COMPLETE.md](./EPIC_A2_COMPLETE.md)** - OAuth implementation details
- **[migrations/README.md](./migrations/README.md)** - Database migration guide

---

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt it for your own use!

### Development Guidelines

1. Follow the TypeScript strict mode
2. Use ESLint configuration provided
3. Write mobile-first responsive CSS
4. Test OAuth flow thoroughly before committing
5. Update documentation when adding features

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Spotify** for their excellent Web API and Web Playback SDK
- **Supabase** for real-time database infrastructure
- **Vercel** for serverless function hosting
- **React** and **Vite** teams for amazing developer experience

---

## 📧 Contact

For questions or feedback, open an issue on GitHub.

---

**Made with ❤️ and lots of ☕**
