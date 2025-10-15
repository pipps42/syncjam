# 🚀 Setup Deploy Vercel - Checklist

## ✅ Deploy Completato!

URL Production: https://syncjam-mqxqo4p5d-pipps42s-projects.vercel.app

---

## 📋 Variabili d'ambiente da configurare

### Variabili già configurate ✅
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_REDIRECT_URI`

### Variabili MANCANTI da aggiungere ⚠️

Devi aggiungere queste variabili per far funzionare le API serverless:

```bash
# 1. Spotify Client Secret (obbligatorio per OAuth)
vercel env add SPOTIFY_CLIENT_SECRET

# 2. Supabase URL
vercel env add SUPABASE_URL

# 3. Supabase Anon Key (pubblico)
vercel env add SUPABASE_ANON_KEY

# 4. Supabase Service Key (privato - per API serverless)
vercel env add SUPABASE_SERVICE_KEY
```

Per ogni comando:
1. Inserisci il valore quando richiesto
2. Seleziona tutti gli ambienti (Development, Preview, Production)
3. Premi Enter

---

## 🔐 Dove trovo i valori?

### Spotify (https://developer.spotify.com/dashboard)
1. Vai alla tua app
2. **SPOTIFY_CLIENT_ID**: visibile in alto
3. **SPOTIFY_CLIENT_SECRET**: clicca "Show Client Secret"
4. **SPOTIFY_REDIRECT_URI**: già configurato ✅

### Supabase (https://supabase.com/dashboard)
1. Vai al tuo progetto
2. Settings → API
3. **SUPABASE_URL**: "Project URL"
4. **SUPABASE_ANON_KEY**: "anon public"
5. **SUPABASE_SERVICE_KEY**: "service_role secret" (⚠️ PRIVATO!)

---

## 📱 Aggiorna Spotify Redirect URI

Nel Spotify Developer Dashboard, aggiungi:

```
https://syncjam-mqxqo4p5d-pipps42s-projects.vercel.app/callback
```

⚠️ **IMPORTANTE**: Vercel ti ha assegnato un URL temporaneo. Per avere un URL fisso:

```bash
vercel alias set syncjam-mqxqo4p5d-pipps42s-projects.vercel.app syncjam.vercel.app
```

Poi usa `https://syncjam.vercel.app/callback` su Spotify.

---

## 🧪 Test Post-Deploy

### 1. Verifica frontend
Vai su: https://syncjam-mqxqo4p5d-pipps42s-projects.vercel.app

Dovresti vedere la homepage.

### 2. Verifica API serverless
Apri browser DevTools → Network e prova a:
- Cliccare "Create Room" → Dovrebbe chiamare `/api/rooms/create`
- Login Spotify → Dovrebbe chiamare `/api/auth/callback`

### 3. Test completo OAuth
1. Vai su app
2. Clicca "Create Room"
3. Login con Spotify Premium
4. Verifica redirect funziona
5. Verifica room viene creata

---

## 🔧 Debug

### Le API non funzionano (404)

**Verifica che le serverless functions siano state deployate:**

```bash
vercel inspect syncjam-mqxqo4p5d-pipps42s-projects.vercel.app
```

Dovresti vedere nella sezione "Functions":
- `api/auth/callback.ts`
- `api/auth/refresh.ts`
- `api/rooms/create.ts`
- `api/rooms/join.ts`

Se NON vedi le functions, il problema è che Vercel non ha rilevato la cartella `/api`.

**Soluzione**: Vercel rileva automaticamente le serverless functions nella cartella `/api`. Verifica che:
1. La cartella si chiami esattamente `api` (lowercase)
2. I file abbiano extension `.ts` o `.js`
3. Ogni file esporti `export default function handler(req, res) { ... }`

### Spotify OAuth redirect fallisce

**Errore**: "Invalid Redirect URI"

**Soluzione**:
1. Verifica nel Spotify Dashboard ci sia ESATTAMENTE:
   ```
   https://syncjam-mqxqo4p5d-pipps42s-projects.vercel.app/callback
   ```
2. Aggiorna la variabile `SPOTIFY_REDIRECT_URI` su Vercel:
   ```bash
   vercel env rm SPOTIFY_REDIRECT_URI
   vercel env add SPOTIFY_REDIRECT_URI
   # Inserisci: https://syncjam-mqxqo4p5d-pipps42s-projects.vercel.app/callback
   ```
3. Ri-deploya:
   ```bash
   vercel --prod
   ```

### Database errors

Se vedi errori tipo "relation does not exist":

1. Verifica di aver eseguito le migrations su Supabase
2. Controlla che `SUPABASE_URL` e keys siano corrette
3. Verifica che le tabelle esistano nel dashboard Supabase

---

## 📊 Comandi utili

```bash
# Vedi i logs in tempo reale
vercel logs syncjam-mqxqo4p5d-pipps42s-projects.vercel.app --follow

# Vedi dettagli deploy
vercel inspect syncjam-mqxqo4p5d-pipps42s-projects.vercel.app

# Lista env vars
vercel env ls

# Pull env vars in locale (crea .env.local)
vercel env pull

# Redeploy (forza nuovo build)
vercel --prod --force
```

---

## ✅ Checklist finale

- [ ] Variabili d'ambiente aggiunte (SPOTIFY_CLIENT_SECRET, SUPABASE_*)
- [ ] Spotify Redirect URI aggiornato con URL Vercel
- [ ] Homepage si apre correttamente
- [ ] Serverless functions deployate (verifica con `vercel inspect`)
- [ ] Login Spotify funziona
- [ ] Room creation funziona
- [ ] Join room funziona (test con incognito)

---

## 🎯 Prossimi passi

Una volta che tutto funziona:

1. **Setup dominio personalizzato** (opzionale)
   ```bash
   vercel domains add yourdomain.com
   ```

2. **Configura Git deploy automatico**
   - Collega repo GitHub su Vercel Dashboard
   - Ogni push su `main` → deploy automatico

3. **Monitora errori**
   - Integra Sentry o simili
   - Controlla Vercel Analytics

Buon deploy! 🚀
