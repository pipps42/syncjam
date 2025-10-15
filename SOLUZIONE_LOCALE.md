# 🚨 PROBLEMA: Come testare in locale con le API serverless?

## ⚠️ Il Problema

Vercel serverless functions **NON possono girare veramente in locale** senza Vercel CLI, ma Vercel CLI ha problemi con progetti Vite.

Hai **DUE OPZIONI**:

---

## ✅ OPZIONE 1: Deploy su Vercel e testa in produzione (CONSIGLIATO)

Questa è l'opzione **più semplice e veloce**.

### Setup una tantum:

```bash
# 1. Installa Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

### Durante il deploy, configura le variabili d'ambiente:

Vercel ti chiederà di configurare:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

### Configura Spotify Redirect URI:

Nel Spotify Dashboard, aggiungi:
```
https://your-app.vercel.app/callback
```

### Testa:

Vai su `https://your-app.vercel.app` e testa normalmente.

**Vantaggi:**
- ✅ Funziona tutto immediatamente
- ✅ Ambiente identico a produzione
- ✅ OAuth Spotify funziona perfettamente
- ✅ Deploy automatico ad ogni push su Git

**Svantaggi:**
- ❌ Devi fare deploy per ogni modifica
- ❌ Più lento per iterazioni rapide

---

## ✅ OPZIONE 2: Serverless functions locale con Express (per sviluppo)

Se vuoi testare in locale DAVVERO, devi creare un server Express che simula le serverless functions.

### 1. Installa dipendenze

```bash
npm install --save-dev express tsx cors
npm install --save-dev @types/express @types/cors
```

### 2. Crea server locale

Crea `server/local-dev.ts`:

\`\`\`typescript
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
app.use(cors());
app.use(express.json());

// Import handlers
import createRoomHandler from '../api/rooms/create.js';
import joinRoomHandler from '../api/rooms/join.js';
import authCallbackHandler from '../api/auth/callback.js';
import authRefreshHandler from '../api/auth/refresh.js';

// Wrapper to convert Vercel handlers to Express
function vercelToExpress(handler: any) {
  return async (req: express.Request, res: express.Response) => {
    const vercelReq = {
      method: req.method,
      body: req.body,
      query: req.query,
      headers: req.headers,
    };

    const vercelRes = {
      status: (code: number) => ({
        json: (data: any) => res.status(code).json(data),
      }),
      json: (data: any) => res.json(data),
    };

    await handler(vercelReq, vercelRes);
  };
}

// Map API routes
app.post('/api/rooms/create', vercelToExpress(createRoomHandler));
app.post('/api/rooms/join', vercelToExpress(joinRoomHandler));
app.get('/api/auth/callback', vercelToExpress(authCallbackHandler));
app.post('/api/auth/refresh', vercelToExpress(authRefreshHandler));

const PORT = 8000;
app.listen(PORT, () => {
  console.log(\`🚀 Local API server running on http://127.0.0.1:\${PORT}\`);
  console.log('Available endpoints:');
  console.log('  POST http://127.0.0.1:8000/api/rooms/create');
  console.log('  POST http://127.0.0.1:8000/api/rooms/join');
  console.log('  GET  http://127.0.0.1:8000/api/auth/callback');
  console.log('  POST http://127.0.0.1:8000/api/auth/refresh');
});
\`\`\`

### 3. Configura Vite per proxy

Modifica `vite.config.ts`:

\`\`\`typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
\`\`\`

### 4. Aggiungi script in package.json

\`\`\`json
{
  "scripts": {
    "dev": "vite",
    "dev:api": "tsx server/local-dev.ts",
    "dev:all": "concurrently \\"npm run dev:api\\" \\"npm run dev\\""
  }
}
\`\`\`

### 5. Installa concurrently

```bash
npm install --save-dev concurrently
```

### 6. Avvia tutto

```bash
npm run dev:all
```

Questo avvia:
- Frontend Vite su `http://127.0.0.1:3000`
- API server su `http://127.0.0.1:8000`
- Proxy automatico `/api/*` → `http://127.0.0.1:8000`

**Vantaggi:**
- ✅ Sviluppo locale completo
- ✅ Hot reload funziona
- ✅ Nessun deploy necessario

**Svantaggi:**
- ❌ Setup più complesso
- ❌ Devi mantenere sincronizzato il server Express con le API Vercel

---

## 🎯 La mia raccomandazione

**Per questa fase del progetto:**

1. **Sviluppo UI**: usa `npm run dev` (solo frontend, mock le API se necessario)
2. **Test funzionalità complete**: fai deploy su Vercel e testa lì
3. **Quando il progetto è più maturo**: implementa Opzione 2 con Express

**Workflow consigliato:**

```bash
# Sviluppo locale UI
npm run dev

# Quando sei pronto a testare OAuth + API:
git add .
git commit -m "feat: ..."
git push

# Deploy automatico su Vercel (se configurato)
# Oppure manuale:
vercel --prod

# Testa su https://your-app.vercel.app
```

---

## 📊 Riepilogo Opzioni

| Feature | Opzione 1 (Vercel) | Opzione 2 (Express) |
|---------|-------------------|---------------------|
| Setup | ⭐⭐⭐⭐⭐ Facile | ⭐⭐ Medio |
| OAuth Spotify | ✅ Funziona | ✅ Funziona |
| Hot Reload | ❌ No | ✅ Si |
| Velocità iterazione | ⭐⭐ Lenta | ⭐⭐⭐⭐⭐ Veloce |
| Ambiente realistico | ✅ Identico prod | ⚠️ Simula prod |
| Costi | 💰 Free tier | 💰 Gratis |

---

## 🚀 Quick Start (Opzione 1)

```bash
# Una tantum
npm install -g vercel
vercel login

# Deploy
vercel --prod

# Configura env vars quando richiesto
# Aggiungi redirect URI su Spotify Dashboard
# Testa su URL Vercel
```

Fatto! 🎉
