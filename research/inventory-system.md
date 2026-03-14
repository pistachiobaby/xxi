# Inventory System — Brainstorm Summary

## Problem

The gacha game has a provably-fair roll system, but rolled items have no persistent ownership beyond the roll audit log. Users roll, see the result, and that's it — no collection, no economy, no reason to keep rolling beyond novelty.

## Architecture

```
roll (immutable audit log)                inventoryItem (mutable game state)
──────────────────────────                ──────────────────────────────────
  bundle, item, user                        belongsTo user (required)
  serverSeed, clientSeed, hash              belongsTo item
  + claimToken (nullable)  ──────────────►  belongsTo roll (provenance)
                                            value: number (from item.value)
                                            soldAt: datetime (null = owned)

user
────
  + balance: number (default 0)     ◄── currency from selling
  + inventory: hasMany inventoryItem
```

### Key Principle: Separation of Concerns

The `roll` model is an **immutable audit trail** for provably-fair verification. The `inventoryItem` model is **mutable game state**. They are linked (inventoryItem.roll for provenance) but never conflated. Selling an item mutates inventoryItem, never the roll.

## Data Model

### roll (modified — one new field)

| Field | Type | Notes |
|---|---|---|
| bundle | belongsTo bundle | unchanged |
| item | belongsTo item | unchanged |
| user | belongsTo user | unchanged, nullable |
| clientSeed | string | unchanged |
| serverSeed | string | unchanged |
| serverSeedHash | string | unchanged |
| **claimToken** | **string (nullable)** | **NEW** — localStorage UUID for anonymous roll claiming |

### inventoryItem (new model)

| Field | Type | Notes |
|---|---|---|
| user | belongsTo user | required — always has an owner |
| item | belongsTo item | what the item is |
| roll | belongsTo roll | provenance — which roll produced this |
| value | number | copied from item.value at creation time |
| soldAt | datetime (nullable) | null = owned, non-null = sold |

### item (modified — one new field)

| Field | Type | Notes |
|---|---|---|
| name | string | unchanged |
| rarity | enum | unchanged |
| color | number | unchanged |
| chance | number | unchanged |
| **value** | **number** | **NEW** — sell value, tunable in Gadget editor |

### user (modified — one new field)

| Field | Type | Notes |
|---|---|---|
| ...existing auth fields... | | unchanged |
| rolls | hasMany roll | unchanged |
| **balance** | **number (default 0)** | **NEW** — currency from selling items |
| **inventory** | **hasMany inventoryItem** | **NEW** — relationship |

## Actions

### roll.create (modified)

- Accept optional `claimToken` param
- If authenticated: set userId, create inventoryItem (value = item.value)
- If anonymous: set claimToken only, no inventoryItem created

### claimAnonymousRolls (new global action)

- Params: `{ claimToken: string }`
- Called server-side from signIn/signUp `onSuccess`
- Finds rolls where `claimToken = token` AND `userId = null`
- For each: set userId, create inventoryItem, clear claimToken
- Transactional

### inventoryItem.sell (new action)

- Guard: soldAt must be null (can't sell twice)
- Set `soldAt = now`
- Add `value` to `user.balance`

### sellAllDuplicates (new global action)

- For each item type in user's inventory, keep the newest, sell the rest
- Sum values into `user.balance`
- Returns count sold and total value

## Anonymous Roll Claiming

### Mechanism

```
First visit              Anonymous Roll           Sign Up / Sign In
──────────               ──────────────           ─────────────────

Generate UUID            roll.create({            signIn/signUp onSuccess:
Store in localStorage      claimToken: uuid,        claimAnonymousRolls({
as "anonClaimToken"        clientSeed,                claimToken: session.anonClaimToken
                           bundleId                 })
                         })                          │
                           │                         ▼
                           ▼                       Find rolls by claimToken
                         roll record:              Set userId on each
                           claimToken: uuid         Create inventoryItems
                           userId: null             Clear claimTokens
                           item: "Iron Sword"
```

### Where the claim lives

**Server-side** — in the signIn/signUp action's `onSuccess`. The claimToken needs to be threaded through the auth flow (passed as a param alongside email/password). This is more reliable than a frontend call because it can't fail from navigation or race conditions.

### Edge cases

- User clears localStorage before signing up → anonymous rolls are orphaned (acceptable)
- User signs up on different browser/device → same, orphaned (unavoidable for client-side tokens)
- User rolls anonymously, signs in to existing account → claim still works (it's the same flow)
- claimToken collision → astronomically unlikely with UUIDs, but the query also filters by userId=null so it's safe

## Value System

Values are a field on the `item` model, tunable in the Gadget editor. Starting values:

| Rarity | Value | Rationale |
|---|---|---|
| Common | 10 | ~77% drop rate, low value |
| Rare | 50 | ~10% drop rate, 5x common |
| Epic | 250 | ~5% drop rate, 25x common |
| Legendary | 1000 | ~1.3% drop rate, 100x common |

These are intentionally ambiguous and will be tuned. The `value` field on `item` means each specific item can have its own price regardless of rarity.

The value is **copied to inventoryItem at creation time**, not referenced live. This means changing an item's value in the editor affects future rolls but not existing inventory. This is the right behavior — you don't want a value rebalance to retroactively change someone's net worth.

## UI

- **Inventory page** — new `/inventory` route (separate from profile, could become a tab later)
- **Profile page** — gains a `balance` display somewhere
- **Roll result** — could show "+1 Iron Sword added to inventory" feedback after rolling

## Future Considerations (not in scope now)

- **Re-roll cost** — spend balance to roll again (the gacha loop)
- **Lock/favorite** — boolean to prevent accidental selling
- **Item leveling / merging** — combine duplicates into higher rarity
- **Trading** — transfer items between users (needs escrow, fraud prevention)
- **Leaderboard** — collection value ranking
- **Pity system** — guaranteed rarity after N rolls without one

## Access Control

| Model | unauthenticated | signed-in |
|---|---|---|
| inventoryItem | none | read own, sell own (filtered by userId) |
| roll | create (with claimToken) | read own, create |
| user.balance | n/a | read own |

**Important**: the existing roll model has an access control gap — signed-in users can currently read ALL rolls (no row filter applied despite `tenant.gelly` existing). This should be fixed as part of this work.
