import { createHmac, createHash, randomBytes } from "crypto";

/** Generate a cryptographically random server seed (32 bytes, hex-encoded). */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hex digest of the input string. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Derive a visual seed (uint32) and roll value [0,1) from HMAC-SHA256(serverSeed, clientSeed). */
export function deriveOutcome(
  serverSeed: string,
  clientSeed: string
): { visualSeed: number; rollValue: number } {
  const hmac = createHmac("sha256", serverSeed).update(clientSeed).digest();
  // First 4 bytes → uint32 for the SpotlightReel animation seed
  const visualSeed = hmac.readUInt32BE(0);
  // Next 4 bytes → normalized to [0, 1)
  const rollValue = hmac.readUInt32BE(4) / 0x100000000;
  return { visualSeed, rollValue };
}
