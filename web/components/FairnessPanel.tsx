import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { sha256, deriveOutcome, weightedSelect } from "../lib/verify";

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface RollResult {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  winnerId: string;
  winnerName: string;
}

interface FairnessPanelProps {
  /** SHA-256 commitment for the next roll, shown before rolling */
  commitment: string | null;
  /** Current client seed — controlled by parent */
  clientSeed: string;
  onClientSeedChange: (seed: string) => void;
  /** Last completed roll, or null if none yet */
  lastRoll: RollResult | null;
  /** Items with chances for verification */
  items: { id: string; name: string; chance: number }[] | null;
  disabled?: boolean;
}

export { type RollResult };

export default function FairnessPanel({
  commitment,
  clientSeed,
  onClientSeedChange,
  lastRoll,
  items,
  disabled,
}: FairnessPanelProps) {
  const [verifyResult, setVerifyResult] = useState<{
    hashValid: boolean;
    computedHash: string;
    rollValue: number;
    visualSeed: number;
    computedWinnerId: string;
    computedWinnerName: string;
    matchesServer: boolean;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const runVerification = async () => {
    if (!lastRoll || !items) return;
    setVerifying(true);
    try {
      const computedHash = await sha256(lastRoll.serverSeed);
      const hashValid = computedHash === lastRoll.serverSeedHash;
      const { visualSeed, rollValue } = await deriveOutcome(
        lastRoll.serverSeed,
        lastRoll.clientSeed
      );
      const computedWinnerId = weightedSelect(rollValue, items);
      const computedWinnerName =
        items.find((i) => i.id === computedWinnerId)?.name ?? "Unknown";
      const matchesServer = computedWinnerId === lastRoll.winnerId;

      setVerifyResult({
        hashValid,
        computedHash,
        rollValue,
        visualSeed,
        computedWinnerId,
        computedWinnerName,
        matchesServer,
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="text-gray-500 hover:text-gray-300 text-xs font-mono underline underline-offset-2 transition-colors"
          title="Provably Fair"
        >
          Provably Fair
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-gray-950 border-gray-800 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white">Provably Fair</SheetTitle>
          <SheetDescription>
            Every roll is cryptographically verifiable. The server commits to a
            seed hash before you roll, and you provide your own seed. After
            rolling, verify the outcome independently.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {/* Client seed section */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-400 text-xs uppercase tracking-wide">
              Your Client Seed
            </Label>
            <div className="flex gap-2">
              <Input
                value={clientSeed}
                onChange={(e) => onClientSeedChange(e.target.value)}
                disabled={disabled}
                className="font-mono text-xs bg-gray-900 border-gray-700 text-gray-200"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClientSeedChange(randomHex(16))}
                disabled={disabled}
                className="shrink-0 border-gray-700 text-gray-400 hover:text-white"
                title="Randomize"
              >
                &#x21bb;
              </Button>
            </div>
            <p className="text-gray-600 text-xs">
              Change this before rolling to add your own entropy.
            </p>
          </div>

          {/* Server commitment section */}
          <div className="flex flex-col gap-2">
            <Label className="text-gray-400 text-xs uppercase tracking-wide">
              Next Roll Commitment
            </Label>
            {commitment ? (
              <code className="text-xs font-mono text-gray-300 bg-gray-900 border border-gray-700 rounded p-2 break-all select-all">
                {commitment}
              </code>
            ) : (
              <span className="text-gray-600 text-xs italic">Loading...</span>
            )}
            <p className="text-gray-600 text-xs">
              SHA-256 hash of the server seed for the next roll. This was locked
              in before you choose your client seed.
            </p>
          </div>

          {/* Last roll verification */}
          <div className="flex flex-col gap-3">
            <Label className="text-gray-400 text-xs uppercase tracking-wide">
              Last Roll
            </Label>
            {lastRoll ? (
              <div className="flex flex-col gap-3">
                <Row label="Winner" value={lastRoll.winnerName} />
                <Row label="Server Seed" value={lastRoll.serverSeed} mono breakAll />
                <Row label="Server Seed Hash" value={lastRoll.serverSeedHash} mono breakAll />
                <Row label="Client Seed" value={lastRoll.clientSeed} mono />

                <Button
                  onClick={runVerification}
                  disabled={verifying}
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:text-white"
                >
                  {verifying ? "Verifying..." : "Verify This Roll"}
                </Button>

                {verifyResult && (
                  <div className="flex flex-col gap-2 bg-gray-900 border border-gray-700 rounded p-3">
                    <VerifyRow
                      label="SHA-256(serverSeed) matches commitment"
                      pass={verifyResult.hashValid}
                    />
                    <div className="text-gray-500 text-xs font-mono break-all">
                      Computed: {verifyResult.computedHash}
                    </div>
                    <VerifyRow
                      label={`HMAC rollValue: ${verifyResult.rollValue.toFixed(10)}`}
                      pass={true}
                    />
                    <VerifyRow
                      label={`Winner: ${verifyResult.computedWinnerName} (id ${verifyResult.computedWinnerId})`}
                      pass={verifyResult.matchesServer}
                    />
                    <div className="border-t border-gray-700 pt-2 mt-1">
                      <VerifyRow
                        label="Outcome verified"
                        pass={verifyResult.hashValid && verifyResult.matchesServer}
                        bold
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-600 text-xs italic">
                No rolls yet. Roll to see verification data.
              </span>
            )}
          </div>

          {/* How it works */}
          <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
            <Label className="text-gray-400 text-xs uppercase tracking-wide">
              How It Works
            </Label>
            <ol className="text-gray-500 text-xs list-decimal list-inside flex flex-col gap-1.5">
              <li>Server generates a secret seed and shows you its SHA-256 hash (commitment)</li>
              <li>You set your client seed (or use the random default)</li>
              <li>You roll — outcome is derived from HMAC-SHA256(serverSeed, clientSeed)</li>
              <li>Server reveals the server seed</li>
              <li>You verify: SHA-256(serverSeed) matches the commitment, and the HMAC produces the same winner</li>
            </ol>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-gray-500 text-xs">{label}</span>
      <span
        className={`text-gray-200 text-xs ${mono ? "font-mono" : ""} ${breakAll ? "break-all select-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function VerifyRow({
  label,
  pass,
  bold,
}: {
  label: string;
  pass: boolean;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 text-xs ${bold ? "font-semibold" : ""}`}>
      <span className={pass ? "text-green-400" : "text-red-400"}>
        {pass ? "\u2713" : "\u2717"}
      </span>
      <span className={pass ? "text-green-300" : "text-red-300"}>{label}</span>
    </div>
  );
}
