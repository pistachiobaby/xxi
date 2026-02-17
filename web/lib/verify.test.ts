import { describe, it, expect } from "vitest";
import { sha256, deriveOutcome, weightedSelect, verifyRoll } from "./verify";

const TEST_SERVER_SEED =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const TEST_CLIENT_SEED = "test-client-seed-123";

const ITEMS = [
  { id: "1", chance: 20 },
  { id: "2", chance: 20 },
  { id: "3", chance: 20 },
  { id: "4", chance: 8 },
  { id: "5", chance: 8 },
  { id: "6", chance: 8 },
  { id: "7", chance: 4 },
  { id: "8", chance: 4 },
  { id: "9", chance: 4 },
  { id: "10", chance: 1 },
  { id: "11", chance: 1 },
  { id: "12", chance: 1 },
];

describe("sha256", () => {
  it("produces correct hex digest", async () => {
    const hash = await sha256(TEST_SERVER_SEED);
    expect(hash).toBe(
      "fa0cacfe1122ac62b0f70e4db95790326bae5a5c38924f315282cc4fd55b4986"
    );
  });

  it("produces correct digest for another input", async () => {
    const hash = await sha256("deadbeef".repeat(8));
    expect(hash).toBe(
      "247d08f3e13938b244f5ecd8966f1778e5e72b175820f46ba86c9c039272affa"
    );
  });
});

describe("deriveOutcome", () => {
  it("returns deterministic visualSeed and rollValue", async () => {
    const { visualSeed, rollValue } = await deriveOutcome(
      TEST_SERVER_SEED,
      TEST_CLIENT_SEED
    );
    expect(visualSeed).toBe(3486865367);
    expect(rollValue).toBeCloseTo(0.6308504354674369, 10);
  });

  it("changes with different client seed", async () => {
    const a = await deriveOutcome(TEST_SERVER_SEED, "seed-a");
    const b = await deriveOutcome(TEST_SERVER_SEED, "seed-b");
    expect(a.visualSeed).not.toBe(b.visualSeed);
  });

  it("changes with different server seed", async () => {
    const a = await deriveOutcome(TEST_SERVER_SEED, TEST_CLIENT_SEED);
    const b = await deriveOutcome("deadbeef".repeat(8), TEST_CLIENT_SEED);
    expect(a.visualSeed).not.toBe(b.visualSeed);
  });
});

describe("weightedSelect", () => {
  it("selects correct item for known rollValue", () => {
    // rollValue 0.6308... * total 99 ≈ 62.45 → items 1(20) + 2(20) + 3(20) = 60, then 4(8) → 62.45 - 60 = 2.45, 2.45 - 8 < 0 → id "4"
    const winnerId = weightedSelect(0.6308504354674369, ITEMS);
    expect(winnerId).toBe("4");
  });

  it("selects first item at rollValue 0", () => {
    expect(weightedSelect(0, ITEMS)).toBe("1");
  });

  it("selects last item at rollValue near 1", () => {
    expect(weightedSelect(0.9999999, ITEMS)).toBe("12");
  });

  it("sorts items by id regardless of input order", () => {
    const shuffled = [...ITEMS].reverse();
    const winnerId = weightedSelect(0.6308504354674369, shuffled);
    expect(winnerId).toBe("4");
  });
});

describe("verifyRoll", () => {
  it("validates a correct roll", async () => {
    const serverSeedHash = await sha256(TEST_SERVER_SEED);
    const { hashValid, winnerId } = await verifyRoll({
      serverSeed: TEST_SERVER_SEED,
      serverSeedHash,
      clientSeed: TEST_CLIENT_SEED,
      items: ITEMS,
    });
    expect(hashValid).toBe(true);
    expect(winnerId).toBe("4");
  });

  it("detects tampered server seed hash", async () => {
    const { hashValid } = await verifyRoll({
      serverSeed: TEST_SERVER_SEED,
      serverSeedHash: "0000000000000000000000000000000000000000000000000000000000000000",
      clientSeed: TEST_CLIENT_SEED,
      items: ITEMS,
    });
    expect(hashValid).toBe(false);
  });

  it("detects different server seed", async () => {
    const fakeServerSeed = "deadbeef".repeat(8);
    const originalHash = await sha256(TEST_SERVER_SEED);
    const { hashValid, winnerId } = await verifyRoll({
      serverSeed: fakeServerSeed,
      serverSeedHash: originalHash,
      clientSeed: TEST_CLIENT_SEED,
      items: ITEMS,
    });
    expect(hashValid).toBe(false);
    // winnerId would be different since server seed changed
  });
});
