# xxi

A provably fair gacha game built on [Gadget](https://gadget.dev) with a PixiJS 8 canvas frontend.

## Architecture

**Backend** (Gadget) handles models, actions, auth, and the GraphQL API. **Frontend** is a React shell wrapping a PixiJS canvas where the game runs.

```
web/
  components/
    PixiCanvas.tsx        React wrapper — initializes PixiJS Application
    SpotlightReel.ts      Reel animation (spin, decelerate, spring-settle)
    ReelItemTile.ts       Individual item tiles on the reel
    RevealEffect.ts       Flash effect on reveal
    FairnessPanel.tsx     Provably fair verification UI
  lib/
    verify.ts             Client-side cryptographic verification (Web Crypto)

api/
  models/
    bundle/               Item bundles (publicly readable)
    bundleSecret/         Server seeds (encrypted, no API access)
    item/                 Items with name, rarity, color, chance
    roll/                 Roll records with revealed seeds
  actions/
    seedBundle.ts         Seeds initial bundle with items
  lib/
    crypto.ts             Server-side seed generation, SHA-256, HMAC-SHA256
```

Game components are plain TypeScript classes extending PixiJS `Container` -- not React components. All live as siblings on `app.stage`.

## Development

```bash
yarn test                              # Run tests (opens browser)
yarn test --run --browser.headless     # Run headless
yarn build                             # Production build
```

Tests use Vitest browser mode with Playwright (Chromium).

## Provably Fair

Every roll outcome is cryptographically verifiable using a commit-reveal scheme with HMAC-SHA256. The server commits to a seed hash before the player rolls, and the player contributes their own entropy. After the roll, the server seed is revealed for independent verification.

See [PROVABLY-FAIR.md](PROVABLY-FAIR.md) for the full protocol specification.
