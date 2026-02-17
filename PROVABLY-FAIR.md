# Provably Fair System

Every roll outcome in xxi is cryptographically verifiable. The server cannot manipulate results, and the player can independently prove this after each roll.

## How It Works

The system uses a **commit-reveal scheme** with HMAC-SHA256:

```
  BEFORE ROLL                           DURING ROLL                         AFTER ROLL

  Server generates               Player provides                   Server reveals
  serverSeed                     clientSeed                        serverSeed
       │                              │                                 │
       ▼                              │                                 ▼
  SHA-256(serverSeed)                 │                          Player verifies:
       │                              │                          SHA-256(serverSeed)
       ▼                              ▼                          === commitment?
  commitment ──────────►  HMAC-SHA256(serverSeed, clientSeed)          │
  (shown to player)                   │                                ▼
                                ┌─────┴─────┐                   Recompute HMAC
                                │  bytes 0-3 │  bytes 4-7       and winner
                                │ visualSeed │  rollValue        === server's winner?
                                └─────┬──────┘     │
                                      │            ▼
                                      │    weightedSelect(rollValue, items)
                                      │            │
                                      ▼            ▼
                                  Animation     Winner
```

**Key insight:** The commitment is published *before* the player chooses their client seed. Since the server seed is already locked, the server cannot change the outcome after seeing the player's input. And since the player contributes their own entropy, the server cannot predict or pre-select outcomes.

## The Two Sides: Server vs Client

The same cryptographic operations run on both sides, in two different environments:

| Operation | Server (`api/lib/crypto.ts`) | Client (`web/lib/verify.ts`) |
|---|---|---|
| SHA-256 | Node.js `crypto.createHash` | Web Crypto `subtle.digest` |
| HMAC-SHA256 | Node.js `crypto.createHmac` | Web Crypto `subtle.sign` |
| Weighted select | Sorted by id, cumulative walk | Sorted by id, cumulative walk |

Both implementations produce identical output for the same inputs. The client library exists solely for post-roll verification.

## Data Flow: What Lives Where

```
  ┌─────────────────────────────────┐     ┌──────────────────────────────┐
  │  bundle (publicly readable)     │     │  bundleSecret (no access)    │
  │                                 │     │                              │
  │  pendingServerSeedHash ◄────────┼──── │  pendingServerSeed           │
  │  (SHA-256 commitment)           │     │  (encrypted at rest)         │
  │                                 │     │                              │
  │  name, items                    │     │  bundle (belongsTo)          │
  └─────────────────────────────────┘     └──────────────────────────────┘
                                                      │
                                               Only accessible via
                                               api.internal (server-side)
```

The actual server seed is stored in `bundleSecret`, a model with **zero permissions** for all roles. No GraphQL query can read it. The field uses Gadget's `encryptedString` type, so it's encrypted at rest in the database. Only server-side action code via `api.internal` can access it.

The public `bundle` model exposes only the `pendingServerSeedHash` (the commitment). This is safe to show because SHA-256 is a one-way function — knowing the hash reveals nothing about the seed.

## Roll Lifecycle

### 1. Seed Generation (bundle creation or rotation)

```
serverSeed  = randomBytes(32).hex()        →  "a3f1...9c2d"  (64 hex chars)
commitment  = SHA-256(serverSeed)           →  "7b2e...f41a"  (64 hex chars)
```

The seed is stored in `bundleSecret.pendingServerSeed`. The commitment is stored in `bundle.pendingServerSeedHash` and shown to the player.

### 2. Roll Execution (`roll/create` action)

```
Inputs:
  serverSeed  = "a3f1...9c2d"     ← from bundleSecret (hidden)
  clientSeed  = "b7c4...3e8f"     ← from player

HMAC-SHA256("a3f1...9c2d", "b7c4...3e8f")
       │
       ▼
  32-byte digest
       │
       ├── bytes 0-3  →  readUint32BE  →  visualSeed (uint32, drives animation)
       └── bytes 4-7  →  readUint32BE  →  / 0x100000000  →  rollValue [0, 1)
                                                                    │
                                                                    ▼
                                                          weightedSelect(rollValue, items)
                                                                    │
                                                                    ▼
                                                                 winnerId
```

### 3. Weighted Selection

Items are sorted by `id` (ascending). The `rollValue` is scaled by total weight, then walked cumulatively:

```
Items (sorted by id):
  Iron Sword     chance=20  ─── rollValue falls here (0-20)    → Iron Sword wins
  Wooden Shield  chance=20  ─── rollValue falls here (20-40)   → Wooden Shield wins
  Health Potion  chance=20  ─── rollValue falls here (40-60)   → Health Potion wins
  Mana Crystal   chance=8   ─── rollValue falls here (60-68)   → Mana Crystal wins
  ...
  Crown of Ages  chance=1   ─── rollValue falls here (98-99)   → Crown of Ages wins
                       ▲
                Total: 99

rollValue * 99 = position on this line
```

### 4. Seed Rotation

After each roll, the server immediately generates a fresh seed for the next roll:

```
  BEFORE ROLL                              AFTER ROLL

  bundleSecret.pendingServerSeed           bundleSecret.pendingServerSeed
  = "a3f1...9c2d" (current)               = "e8d2...1f7b" (next, freshly generated)

  bundle.pendingServerSeedHash             bundle.pendingServerSeedHash
  = SHA-256("a3f1...9c2d")                 = SHA-256("e8d2...1f7b")

  roll record:
    serverSeed     = "a3f1...9c2d"         ← revealed (was the pending seed)
    serverSeedHash = SHA-256("a3f1...9c2d") ← commitment at time of roll
    clientSeed     = "b7c4...3e8f"         ← player's input
    item           = winnerId              ← outcome
```

The revealed `serverSeed` on the roll record is the one whose hash was shown as the commitment *before* the roll. The player can now verify the entire chain.

## Verification (Player-Side)

The fairness panel lets the player verify any completed roll:

```
Given from roll record:
  serverSeed     = "a3f1...9c2d"
  serverSeedHash = "7b2e...f41a"   (was the commitment)
  clientSeed     = "b7c4...3e8f"

Step 1: SHA-256("a3f1...9c2d")  →  "7b2e...f41a"
        === serverSeedHash?     →  true  ✓  (seed matches commitment)

Step 2: HMAC-SHA256("a3f1...9c2d", "b7c4...3e8f")
        → rollValue = 0.7234...
        → weightedSelect(0.7234, items)
        → "Mana Crystal"
        === roll.item?          →  true  ✓  (outcome is correct)
```

If either check fails, the server cheated. Both checks passing proves the outcome was determined solely by the committed seed and the player's input.

## Security Properties

| Property | Mechanism |
|---|---|
| Server can't change outcome after player input | Commitment published before clientSeed is chosen |
| Server can't predict player input | Player generates clientSeed locally (random or custom) |
| Server seed can't be guessed | 32 bytes of `crypto.randomBytes` (256 bits of entropy) |
| Server seed can't be read before reveal | Stored in `bundleSecret` (no API access, encrypted at rest) |
| Outcome is deterministic | HMAC-SHA256 + sorted weighted select = same inputs always produce same output |
| Player can verify independently | All crypto uses standard primitives available in any language |

## File Reference

| File | Role |
|---|---|
| `api/lib/crypto.ts` | Server-side seed generation, SHA-256, HMAC-SHA256 |
| `web/lib/verify.ts` | Client-side verification (Web Crypto API) |
| `api/models/bundleSecret/schema.gadget.ts` | Stores `pendingServerSeed` (encryptedString, no permissions) |
| `api/models/bundle/schema.gadget.ts` | Stores `pendingServerSeedHash` (public commitment) |
| `api/models/roll/actions/create.ts` | Roll execution: derive outcome, reveal seed, rotate |
| `api/actions/seedBundle.ts` | Initial seed generation and backfill |
| `web/components/FairnessPanel.tsx` | Verification UI |
