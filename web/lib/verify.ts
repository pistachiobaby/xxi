/** Browser-side provably fair verification using Web Crypto API. */

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** SHA-256 hex digest. */
export async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encode(input));
  return hexFromBuffer(hash);
}

/** Derive visualSeed (uint32) and rollValue [0,1) from HMAC-SHA256(serverSeed, clientSeed). */
export async function deriveOutcome(
  serverSeed: string,
  clientSeed: string
): Promise<{ visualSeed: number; rollValue: number }> {
  const key = await crypto.subtle.importKey(
    "raw",
    encode(serverSeed),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encode(clientSeed));
  const view = new DataView(sig);
  const visualSeed = view.getUint32(0, false); // big-endian, bytes 0-3
  const rollValue = view.getUint32(4, false) / 0x100000000; // bytes 4-7
  return { visualSeed, rollValue };
}

/** Weighted selection — must match backend algorithm exactly. Items sorted by id. */
export function weightedSelect(
  rollValue: number,
  items: { id: string; chance: number }[]
): string {
  const sorted = [...items].sort((a, b) => Number(a.id) - Number(b.id));
  const total = sorted.reduce((sum, i) => sum + i.chance, 0);
  let roll = rollValue * total;
  for (const item of sorted) {
    roll -= item.chance;
    if (roll <= 0) return item.id;
  }
  return sorted[sorted.length - 1].id;
}

/** Verify a roll: check hash commitment and recompute the winner. */
export async function verifyRoll({
  serverSeed,
  serverSeedHash,
  clientSeed,
  items,
}: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  items: { id: string; chance: number }[];
}): Promise<{ hashValid: boolean; winnerId: string }> {
  const computedHash = await sha256(serverSeed);
  const hashValid = computedHash === serverSeedHash;
  const { rollValue } = await deriveOutcome(serverSeed, clientSeed);
  const winnerId = weightedSelect(rollValue, items);
  return { hashValid, winnerId };
}
