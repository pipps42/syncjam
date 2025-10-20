# Supabase Realtime - Guida all'utilizzo in SyncJam

## Cos'è Supabase Realtime?

Supabase Realtime è un sistema di comunicazione in tempo reale basato sui **Write-Ahead Logs (WAL)** di PostgreSQL. Permette ai client di ascoltare i cambiamenti del database (INSERT, UPDATE, DELETE) senza dover fare polling continuo.

## Configurazione necessaria

Per abilitare Realtime su una tabella servono **3 step**:

### 1. Database: REPLICA IDENTITY FULL

```sql
ALTER TABLE public.queue_items REPLICA IDENTITY FULL;
```

**Perché è necessario?**
- `REPLICA IDENTITY` determina quali dati vengono inclusi negli eventi WAL
- **DEFAULT**: Solo la primary key → eventi UPDATE/DELETE contengono solo `id`
- **FULL**: Tutti i campi → eventi contengono l'intera riga

**Esempio pratico:**
```typescript
// Filtro lato client
.on('postgres_changes', {
  filter: `room_id=eq.${roomId}`  // ← Serve room_id nell'evento!
})
```

Senza `REPLICA IDENTITY FULL`, il filtro `room_id=eq.${roomId}` **non funzionerebbe** per UPDATE/DELETE perché `room_id` non sarebbe nell'evento → riceveresti cambiamenti di TUTTE le room!

### 2. Dashboard Supabase: Abilitare Realtime

1. Vai su: `Database > Replication`
2. Trova la tabella (es. `queue_items`)
3. Abilita la checkbox **"Realtime"**

Senza questo step, anche con `REPLICA IDENTITY FULL`, Supabase non pubblica eventi ai client.

### 3. Row Level Security (RLS)

Le policy RLS si applicano anche agli eventi Realtime:
- Policy **SELECT**: Determina quali eventi riceve il client
- Policy **INSERT/UPDATE/DELETE**: Determina quali operazioni può fare il client

**Esempio per queue_items:**
```sql
-- Tutti possono vedere gli eventi (ma il client filtra per room_id)
CREATE POLICY "Anyone can view queue items"
  ON public.queue_items
  FOR SELECT
  USING (true);
```

**Realtime RLS (opzionale):**
Se abiliti "Realtime RLS" nella dashboard, Supabase applica le policy SELECT server-side, così ogni client riceve **solo gli eventi che ha permesso di vedere**.

---

## Caso d'uso 1: Queue (implementato)

### Implementazione

**Frontend: `src/components/room/QueueTab.tsx`**

```typescript
useEffect(() => {
  loadQueue(); // Caricamento iniziale

  // Subscribe to real-time queue updates
  const channel = supabase
    .channel(`queue:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',              // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'queue_items',
        filter: `room_id=eq.${roomId}`  // Solo eventi di questa room
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setQueueItems(prev => [...prev, payload.new as QueueItem]);
        } else if (payload.eventType === 'UPDATE') {
          setQueueItems(prev =>
            prev.map(item => item.id === payload.new.id ? payload.new : item)
          );
        } else if (payload.eventType === 'DELETE') {
          setQueueItems(prev => prev.filter(item => item.id !== payload.old.id));
        }
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status); // 'SUBSCRIBED' se OK
    });

  return () => channel.unsubscribe();
}, [roomId]);
```

### Come funziona

1. **Utente A** aggiunge un brano → Supabase Direct INSERT
2. **PostgreSQL** scrive nel WAL
3. **Supabase Realtime** legge il WAL e pubblica l'evento
4. **Utente B** (iscritto al canale `queue:${roomId}`) riceve l'evento INSERT
5. **Frontend** aggiorna `queueItems` state → UI si aggiorna automaticamente

### Vantaggi

✅ **Nessun polling** - Zero chiamate GET ripetute
✅ **Latenza bassa** - Aggiornamenti quasi istantanei (< 100ms)
✅ **Scalabile** - Un canale per room, non uno per utente
✅ **Filtrato** - Ogni room riceve solo i propri eventi grazie a `filter`

---

## Caso d'uso 2: Chat (futuro)

### Schema database

```sql
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.auth_sessions(user_id) ON DELETE SET NULL,
  nickname TEXT,  -- Per utenti anonimi
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Abilita Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
```

### Implementazione suggerita

**Component: `ChatTab.tsx`**

```typescript
useEffect(() => {
  loadMessages();

  const channel = supabase
    .channel(`chat:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',  // Solo nuovi messaggi
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages(prev => [...prev, newMessage]);

        // Scroll automatico al nuovo messaggio
        scrollToBottom();

        // Notifica sonora (opzionale)
        if (newMessage.user_id !== currentUserId) {
          playNotificationSound();
        }
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, [roomId]);
```

### Feature aggiuntive con Presence

**"Chi sta scrivendo..."**

```typescript
const channel = supabase.channel(`chat:${roomId}`, {
  config: {
    presence: {
      key: currentUserId || currentUserNickname
    }
  }
})
.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  // state = { 'user123': [...], 'GuestMario': [...] }
})
.on('broadcast', { event: 'typing' }, (payload) => {
  setTypingUsers(prev => [...prev, payload.userId]);

  setTimeout(() => {
    setTypingUsers(prev => prev.filter(id => id !== payload.userId));
  }, 3000);
});

// Quando l'utente scrive
function handleTyping() {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: currentUserId || currentUserNickname }
  });
}
```

**Vantaggi per la chat:**
- Messaggi istantanei senza refresh
- Indicatore "sta scrivendo..." con Presence/Broadcast
- Lista utenti online in real-time
- Notifiche per nuovi messaggi

---

## Caso d'uso 3: Public Rooms List (possibile implementazione)

### Problema attuale

**Homepage (`src/components/home/Home.tsx`)** - Attualmente usa polling:

```typescript
// ❌ Problema: Polling ogni 10 secondi
useEffect(() => {
  loadPublicRooms();

  const interval = setInterval(() => {
    loadPublicRooms(); // GET /api/rooms?action=list ogni 10s
  }, 10000);

  return () => clearInterval(interval);
}, []);
```

**Svantaggi:**
- ❌ Chiamate ripetute anche se non ci sono cambiamenti
- ❌ Latenza fino a 10 secondi per vedere nuove room
- ❌ Spreco di risorse (serverless function invocata ogni 10s per ogni utente)

### Soluzione con Realtime

**Migration:**

```sql
-- Abilita Realtime per rooms
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
```

**Dashboard:** Abilita Realtime per la tabella `rooms`

**Frontend: `src/components/home/Home.tsx`**

```typescript
useEffect(() => {
  loadPublicRooms(); // Caricamento iniziale

  const channel = supabase
    .channel('public-rooms')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rooms',
        filter: 'is_public=eq.true'  // Solo room pubbliche
      },
      (payload) => {
        const newRoom = payload.new as Room;
        setPublicRooms(prev => [newRoom, ...prev]);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: 'is_public=eq.true'
      },
      (payload) => {
        const updatedRoom = payload.new as Room;
        setPublicRooms(prev =>
          prev.map(room => room.id === updatedRoom.id ? updatedRoom : room)
        );
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'rooms'
      },
      (payload) => {
        setPublicRooms(prev =>
          prev.filter(room => room.id !== payload.old.id)
        );
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, []);
```

### Vantaggi

✅ **Nessun polling** - GET solo al mount iniziale
✅ **Aggiornamenti istantanei** - Nuove room appaiono immediatamente
✅ **Risparmio risorse** - Zero invocazioni serverless ripetute
✅ **Miglior UX** - Utente vede nuove room appena create
✅ **Scalabile** - Un canale condiviso per tutti gli utenti in homepage

### Caso particolare: Conteggio partecipanti

**Problema:** Il conteggio partecipanti cambia spesso ma `rooms` table non viene aggiornata.

**Opzione A: Ascoltare anche `participants`**

```typescript
.on(
  'postgres_changes',
  {
    event: '*',  // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'participants'
  },
  (payload) => {
    // Quando cambia un participant, ricarica le room
    loadPublicRooms();
  }
)
```

**Opzione B: Denormalizzare** (aggiornare `participant_count` in `rooms` con un trigger)

```sql
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rooms
  SET participant_count = (
    SELECT COUNT(*)
    FROM public.participants
    WHERE room_id = COALESCE(NEW.room_id, OLD.room_id)
      AND connection_status = 'connected'
  )
  WHERE id = COALESCE(NEW.room_id, OLD.room_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_count
  AFTER INSERT OR UPDATE OR DELETE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION update_room_participant_count();
```

Con l'Opzione B, quando cambia un participant, il trigger aggiorna `rooms.participant_count` → evento UPDATE su `rooms` → Realtime lo notifica.

---

## Best Practices

### 1. Naming dei canali

**✅ Buono:**
```typescript
.channel(`queue:${roomId}`)    // Specifico per risorsa
.channel(`chat:${roomId}`)
.channel('public-rooms')        // Globale ma descrittivo
```

**❌ Cattivo:**
```typescript
.channel('room123')  // Ambiguo, cosa ascolta?
.channel('updates')  // Troppo generico
```

### 2. Cleanup delle subscription

**✅ Sempre unsubscribe:**
```typescript
useEffect(() => {
  const channel = supabase.channel('...')...subscribe();

  return () => {
    channel.unsubscribe();  // IMPORTANTE!
  };
}, [roomId]);
```

Senza `unsubscribe()` si creano **memory leak** e connessioni zombie.

### 3. Gestione errori

```typescript
.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') {
    console.log('[Realtime] Connected');
  } else if (status === 'CHANNEL_ERROR') {
    console.error('[Realtime] Error:', err);
    // Retry logic
  } else if (status === 'TIMED_OUT') {
    console.warn('[Realtime] Timeout, retrying...');
  }
});
```

### 4. Ottimizzazione UPDATE

Se hai molti UPDATE, evita re-render inutili:

```typescript
.on('postgres_changes', { event: 'UPDATE' }, (payload) => {
  setQueueItems(prev =>
    prev.map(item => {
      if (item.id !== payload.new.id) return item;

      // Confronta se è davvero cambiato
      if (JSON.stringify(item) === JSON.stringify(payload.new)) {
        return item;  // Nessun cambiamento, mantieni riferimento
      }

      return payload.new as QueueItem;
    })
  );
});
```

### 5. Filtraggio sempre lato server

**✅ Buono:**
```typescript
.on('postgres_changes', {
  filter: `room_id=eq.${roomId}`  // Filtra nel server
})
```

**❌ Cattivo:**
```typescript
.on('postgres_changes', {
  // Nessun filtro → ricevi TUTTI gli eventi
}, (payload) => {
  if (payload.new.room_id === roomId) {  // Filtra nel client
    // ...
  }
})
```

Il secondo approccio spreca banda ricevendo eventi inutili.

---

## Limitazioni e considerazioni

### 1. Rate Limiting

Supabase ha limiti sul numero di messaggi Realtime:
- **Free tier**: ~200 connessioni simultanee, ~2 milioni messaggi/mese
- **Pro tier**: ~500 connessioni, ~5 milioni messaggi/mese

Per app con molti utenti, considera:
- Raggruppare eventi (es. batch di voti invece di uno alla volta)
- Usare Broadcast per eventi effimeri (typing indicators)
- Implementare debounce per eventi frequenti

### 2. Dimensione eventi

Eventi molto grandi (es. `metadata JSONB` da 100KB) consumano banda.

**Soluzione:** Minimizza i dati in `metadata`:
```typescript
metadata: {
  name: track.name,
  artists: track.artists,  // Array di stringhe, non oggetti completi
  albumImage: track.albumImage,  // Solo URL, non tutto l'oggetto album
}
```

### 3. Sicurezza

**SEMPRE usare RLS policies!**

Senza RLS, un utente malintenzionato potrebbe:
- Vedere eventi di room private
- Ricevere dati sensibili

```sql
-- ❌ MAI fare questo in produzione
CREATE POLICY "Allow all" ON table_name FOR SELECT USING (true);

-- ✅ Filtra sempre per ownership/membership
CREATE POLICY "View own room data" ON table_name
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE room_id = table_name.room_id
        AND user_id = auth.uid()
    )
  );
```

---

## Riepilogo implementazioni

| Feature | Tabella | Realtime abilitato | Implementazione | Status |
|---------|---------|-------------------|-----------------|--------|
| **Queue** | `queue_items` | ✅ Sì | `QueueTab.tsx` | ✅ **Implementato** |
| **Chat** | `chat_messages` | ❌ No (tabella non esiste) | - | ⏳ **Futuro** |
| **Public Rooms** | `rooms` | ❌ No | Attualmente usa polling | ⚠️ **Da migliorare** |
| **Participants** | `participants` | ❌ No | Caricati al mount | ⚠️ **Da considerare** |

---

## Prossimi passi consigliati

1. **Abilitare Realtime per `rooms`** → Eliminare polling in Homepage
2. **Abilitare Realtime per `participants`** → Vedere join/leave in tempo reale
3. **Implementare Chat con Realtime** → Messaggi istantanei
4. **Aggiungere Presence** → "Who's online" e "typing indicators"
5. **Monitorare performance** → Logs Supabase per tracking uso Realtime

---

## Risorse utili

- **Docs ufficiali:** https://supabase.com/docs/guides/realtime
- **Dashboard progetto:** https://supabase.com/dashboard/project/chwffcxugbzvwrxoullc
- **Replication settings:** https://supabase.com/dashboard/project/chwffcxugbzvwrxoullc/database/replication
- **Realtime inspector:** https://supabase.com/dashboard/project/chwffcxugbzvwrxoullc/logs/realtime-logs
