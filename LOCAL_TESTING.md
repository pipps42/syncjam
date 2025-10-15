# 🧪 Testing SyncJam Locally

Questa guida ti spiega come testare l'intera applicazione in locale senza dover fare deploy su Vercel.

## 📋 Prerequisiti

1. ✅ Migrations eseguite su Supabase
2. ✅ Account Spotify Developer con app creata
3. ✅ Node.js installato

## 🚀 Setup - Opzione 1: Vercel CLI (CONSIGLIATO)

### 1. Installa Vercel CLI globalmente

```bash
npm install -g vercel
```

### 2. Configura le variabili d'ambiente

Copia `.env.local` in `.env` e compila con i tuoi valori reali:

```bash
cp .env.local .env
```

Modifica `.env` con:
- **SPOTIFY_CLIENT_ID** e **SPOTIFY_CLIENT_SECRET** dalla tua Spotify App
- **SUPABASE_URL**, **SUPABASE_ANON_KEY**, **SUPABASE_SERVICE_KEY** dal tuo progetto Supabase
- **SPOTIFY_REDIRECT_URI** = `http://127.0.0.1:3000/callback` (⚠️ usa **127.0.0.1** non localhost - Spotify richiede IP o dominio)

### 3. Configura Spotify Redirect URI

⚠️ **IMPORTANTE:** Spotify NON accetta `localhost` nelle Redirect URIs. Devi usare l'indirizzo IP.

Nel tuo Spotify Developer Dashboard, aggiungi:
```
http://127.0.0.1:3000/callback
```
nelle "Redirect URIs" della tua app.

### 4. Avvia il server di sviluppo Vercel

```bash
npm run dev:vercel
```

Questo comando:
- ✅ Avvia Vite per il frontend su `http://localhost:3000`
- ✅ Esegue le serverless functions di `/api/*` in locale
- ✅ Simula esattamente l'ambiente Vercel

### 5. Apri il browser

Vai su: **http://127.0.0.1:3000**

⚠️ **Usa 127.0.0.1 invece di localhost** per mantenere coerenza con la Redirect URI configurata su Spotify.

---

## 🔧 Setup - Opzione 2: Vite Dev Server + Proxy (Alternativa)

Se non vuoi usare Vercel CLI, puoi creare un proxy per le API.

### 1. Crea un file di configurazione Vite

Modifica `vite.config.ts` per aggiungere un proxy:

\`\`\`typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Server API separato
        changeOrigin: true,
      }
    }
  }
})
\`\`\`

### 2. Crea un server Express per le API

Installa dipendenze:
```bash
npm install --save-dev express tsx
```

Crea `server/dev-server.ts`:
```typescript
import express from 'express';
import createRoom from '../api/rooms/create';
import joinRoom from '../api/rooms/join';
// ... import altri endpoint

const app = express();
app.use(express.json());

app.post('/api/rooms/create', createRoom);
app.post('/api/rooms/join', joinRoom);

app.listen(8000, () => {
  console.log('Dev API server running on http://localhost:8000');
});
```

### 3. Aggiungi script in package.json

```json
"scripts": {
  "dev:api": "tsx server/dev-server.ts",
  "dev:frontend": "vite",
  "dev:all": "concurrently \"npm run dev:api\" \"npm run dev:frontend\""
}
```

### 4. Avvia tutto

```bash
npm run dev:all
```

---

## 🧪 Test Flussi Completi

### Test 1: Host crea room (Spotify Premium richiesto)

1. Vai su `http://127.0.0.1:3000`
2. Clicca "Create Room"
3. Login con Spotify Premium
4. Inserisci nome room → Crea
5. Verifica:
   - ✅ Vedi codice room (es. `ABC123`)
   - ✅ Badge "👑 Host"
   - ✅ Bottone "Share Link" funziona

### Test 2: Guest anonimo join via link

1. Copia link condiviso (es. `http://127.0.0.1:3000/join?code=ABC123`)
2. Apri in finestra **incognito**
3. Inserisci nickname
4. Clicca "Join Room"
5. Verifica:
   - ✅ Entri nella room
   - ✅ Vedi host nella lista partecipanti
   - ✅ Il tuo nickname appare

### Test 3: Guest Spotify (non-Premium) join manuale

1. Apri nuova finestra browser
2. Vai su `http://127.0.0.1:3000`
3. Clicca "Join a Room"
4. Inserisci codice manualmente
5. Clicca "Sign in with Spotify"
6. Login con account Spotify FREE
7. Verifica:
   - ✅ Entri nella room
   - ✅ Vedi indicazione "non-Premium"

---

## 🔍 Debug

### Le API non funzionano

**Problema**: Chiamate a `/api/*` danno 404

**Soluzione**:
- Se usi Vercel CLI: assicurati che `vercel.json` sia configurato
- Verifica che le variabili d'ambiente siano caricate
- Controlla console Vercel per errori

### Spotify OAuth redirect fallisce

**Problema**: Dopo login Spotify, redirect a pagina bianca o errore "Invalid Redirect URI"

**Soluzione**:
1. ⚠️ **IMPORTANTE**: Verifica `SPOTIFY_REDIRECT_URI` in `.env` = `http://127.0.0.1:3000/callback` (NON localhost)
2. Verifica che nel Spotify Dashboard ci sia **esattamente** `http://127.0.0.1:3000/callback`
3. Controlla che porta sia **3000** (Vercel dev)
4. Accedi all'app usando `http://127.0.0.1:3000` (non localhost)

### Supabase realtime non funziona

**Problema**: Partecipanti non si aggiornano in tempo reale

**Soluzione**:
1. Verifica che hai eseguito migration 002
2. Controlla che `ALTER PUBLICATION supabase_realtime ADD TABLE` sia stato eseguito
3. Nella console Supabase > Database > Publications, verifica che tabelle `rooms` e `participants` siano incluse

---

## 📊 Variabili d'ambiente richieste

### Backend (serverless functions)
```
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
```

### Frontend (Vite - con prefisso VITE_)
```
VITE_SPOTIFY_CLIENT_ID=xxx
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

⚠️ **Nota**: Usa `127.0.0.1` invece di `localhost` perché Spotify non accetta localhost nelle Redirect URIs.

---

## ✅ Checklist prima di testare

- [ ] Migration 001 eseguita su Supabase
- [ ] Migration 002 eseguita su Supabase
- [ ] Spotify App creata con redirect URI configurato
- [ ] File `.env` compilato con valori reali
- [ ] Vercel CLI installato (`npm install -g vercel`)
- [ ] `npm run dev:vercel` avviato con successo
- [ ] Browser aperto su `http://127.0.0.1:3000` (⚠️ NON localhost)

---

## 🎯 Prossimi passi dopo test locale

Quando tutto funziona in locale:

1. Commit codice su Git
2. Deploy su Vercel: `vercel --prod`
3. Configura variabili d'ambiente su Vercel Dashboard
4. Aggiorna Spotify Redirect URI con URL produzione
5. Testa in produzione!
