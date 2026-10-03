# Kept — Good food. Shared lives.

> **Offline-first household grocery and meal planner — production-quality portfolio project.**

---

## Live Demo

**Dev server:** http://127.0.0.1:5173
**Default view:** Desktop (toggle Mobile 390px preview in the top bar)

---

## Architecture Diagram

```
Browser (Device)
  React UI (stateful)
    |-- write --> Dexie.js (IndexedDB)
    |               items / meals / recipes / members
    |               outbox_operations
    |
    |             Sync Engine
    |               - Outbox Queue (FIFO, in-order)
    |               - Retry with exponential backoff
    |               - Conflict Resolver (CRDT field-level)
    |
    +-- flush / receive --> Supabase Cloud
                              Postgres (RLS)
                              Realtime broadcast
```

---

## Offline Strategy

### 1. Local-First Writes
Every mutation is written to IndexedDB via Dexie.js BEFORE any network call.
The UI updates optimistically from local state.

### 2. Outbox Queue
After the local write, an OutboxOperation (INSERT / UPDATE / DELETE) is
appended to the outbox_operations table. The Sync Engine processes this
queue in FIFO order when network is available.

### 3. Simulated Offline Mode
The top-bar Online / Simulated Offline toggle lets you demonstrate
the full offline path without killing Wi-Fi.

### 4. Service Worker (PWA)
vite-plugin-pwa + Workbox precaches the full app shell so Kept loads
from cache with zero connectivity.

---

## Conflict Resolution — Deterministic Field-Level Merge

Kept uses field-level last-write-wins — NOT whole-row overwrite.

### Algorithm

For each field F of an incoming remote update:
  localMeta  = item.field_metadata[F]   // { value, updated_at, updated_by }
  remoteMeta = incoming.field_metadata[F]

  if remoteMeta.updated_at > localMeta.updated_at:
    winner = remote   // remote is strictly newer
  elif remoteMeta.updated_at < localMeta.updated_at:
    winner = local    // local is strictly newer
  else:
    // Same timestamp — tie-break by lexicographic user_id
    winner = remote.updated_by < local.updated_by ? remote : local

### Why this works
- No central lock: Each field carries its own vector (updated_at + updated_by)
  so two devices can edit different fields of the same item simultaneously.
- Deterministic tie-break: Lexicographic user_id comparison guarantees
  both clients converge to the same winner independently.
- Audit trail: conflictHistory in SyncEngineStatus logs every resolved
  conflict — visible in the Sync Inspector modal (Sparkles icon in top bar).

---

## Tech Stack

| Layer          | Technology                             |
|----------------|----------------------------------------|
| UI Framework   | React 18 + TypeScript                  |
| Build Tool     | Vite 5                                 |
| Styling        | Tailwind CSS 3 (custom warm palette)   |
| Local Storage  | Dexie.js 4 -> IndexedDB               |
| Cloud Backend  | Supabase (Postgres + Realtime + RLS)   |
| PWA            | vite-plugin-pwa + Workbox              |
| Testing        | Vitest (10 unit tests)                 |
| Fonts          | Newsreader + Plus Jakarta Sans         |

---

## Getting Started

### 1. Install dependencies
```sh
npm install
```

### 2. Configure environment (optional)
```sh
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# Without them, the app runs in local simulation mode — no backend needed.
```

### 3. Run development server
```sh
npm run dev
```

### 4. Run unit tests
```sh
npx vitest run
```

### 5. Production build
```sh
npm run build
```

---

## Database Schema (Dexie / IndexedDB)

```
KeptDB v1
├── households         (id)
├── household_members  (id, household_id, user_id)
├── lists              (id, household_id)
├── items              (id, household_id, list_id, category, checked, sync_status)
├── recipes            (id, household_id)
├── meals              (id, household_id, week_start, day_of_week, meal_type)
└── outbox_operations  (id, entity_type, entity_id, operation_type, status)
```

---

## Project Structure

```
src/
├── App.tsx
├── components/
│   ├── AddItemSheet.tsx
│   ├── GroceryItem.tsx
│   ├── GrocerySection.tsx
│   ├── HouseholdModal.tsx
│   ├── MealCard.tsx
│   ├── MobileNav.tsx
│   ├── RecipeCard.tsx
│   ├── Sidebar.tsx
│   ├── SyncIndicator.tsx
│   ├── SyncModal.tsx
│   └── TopBar.tsx
├── db/
│   └── database.ts
├── lib/
│   ├── seedData.ts
│   ├── supabase.ts
│   └── utils.ts
├── pages/
│   ├── Groceries.tsx
│   ├── Home.tsx
│   ├── Household.tsx
│   ├── Meals.tsx
│   ├── MobileGroceryView.tsx
│   ├── Recipes.tsx
│   └── Settings.tsx
└── sync/
    ├── conflictResolver.ts
    ├── outbox.ts
    ├── realtime.ts
    ├── syncEngine.ts
    └── types.ts
```

---

## Tests

```sh
npx vitest run
# ✓ src/tests/conflictResolver.test.ts (10 tests) 27ms
```

Tests cover:
1. Remote wins when strictly newer
2. Local wins when strictly newer
3. Tie-break by lexicographic user_id (lower ID wins)
4. Tie-break in opposite direction
5. Partial update — unchanged fields preserved
6. deleted_at field propagation
7. checked field conflict resolution
8. Multi-field concurrent edit
9. No-metadata fallback (graceful degradation)
10. Idempotent merge (same input yields same output)

---

## Design Language

| Token          | Value     | Usage                          |
|----------------|-----------|--------------------------------|
| cream-100      | #FAF7F2   | App background                 |
| terracotta-500 | #C85A32   | Primary CTAs, active states    |
| botanical-600  | #2D5A43   | Synced state, secondary actions|
| ink-900        | #1C1917   | Body text (near-black)         |
| borderWarm     | #E8E2D8   | Dividers, card borders         |

Typography: **Newsreader** (headings) + **Plus Jakarta Sans** (UI text)

---

*Kept — a portfolio-quality demonstration of offline-first architecture.*