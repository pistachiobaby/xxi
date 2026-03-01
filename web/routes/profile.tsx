import { useState } from "react";
import { UserIcon } from "@/components/shared/UserIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useActionForm, useFindMany, useUser } from "@gadgetinc/react";
import { api } from "../api";
import { sha256, deriveOutcome, weightedSelect } from "../lib/verify";

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-gray-500",
  Rare: "bg-blue-600",
  Epic: "bg-purple-600",
  Legendary: "bg-orange-500",
};

type VerifyResult = {
  hashValid: boolean;
  computedHash: string;
  rollValue: number;
  computedWinnerId: string;
  computedWinnerName: string;
  matchesServer: boolean;
};

export default function ProfilePage() {
  const user = useUser(api);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const hasName = user.firstName || user.lastName;
  const title = hasName ? `${user.firstName} ${user.lastName}` : user.email;

  const [{ data: rolls, fetching, error }] = useFindMany(api.roll, {
    filter: { userId: { equals: user.id } },
    sort: { createdAt: "Descending" },
    select: {
      id: true,
      createdAt: true,
      serverSeed: true,
      clientSeed: true,
      serverSeedHash: true,
      item: { id: true, name: true, rarity: true, chance: true },
      bundle: {
        items: {
          edges: {
            node: { id: true, name: true, chance: true },
          },
        },
      },
    },
  });

  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [verifying, setVerifying] = useState<string | null>(null);

  const verify = async (roll: NonNullable<typeof rolls>[number]) => {
    if (!roll.serverSeed || !roll.clientSeed || !roll.serverSeedHash || !roll.bundle?.items?.edges)
      return;

    setVerifying(roll.id);
    try {
      const items = roll.bundle.items.edges.map((e: any) => ({
        id: e.node.id as string,
        name: e.node.name as string,
        chance: e.node.chance as number,
      }));

      const computedHash = await sha256(roll.serverSeed);
      const hashValid = computedHash === roll.serverSeedHash;
      const { rollValue } = await deriveOutcome(roll.serverSeed, roll.clientSeed);
      const computedWinnerId = weightedSelect(rollValue, items);
      const computedWinnerName = items.find((i) => i.id === computedWinnerId)?.name ?? "Unknown";
      const matchesServer = computedWinnerId === roll.item?.id;

      setResults((prev) => ({
        ...prev,
        [roll.id]: {
          hashValid,
          computedHash,
          rollValue,
          computedWinnerId,
          computedWinnerName,
          matchesServer,
        },
      }));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="grid gap-6">
        {/* Profile card */}
        <div className="rounded-lg shadow p-6 bg-background border">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <UserIcon user={user} className="h-16 w-16" />
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                {hasName && <p className="text-muted-foreground">{user.email}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {!user.googleProfileId && (
                <Button variant="ghost" onClick={() => setIsChangingPassword(true)}>
                  Change password
                </Button>
              )}
              <Button variant="ghost" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Roll history */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Roll History</h2>

          {fetching && <p className="text-muted-foreground">Loading rolls...</p>}
          {error && <p className="text-destructive">Failed to load rolls.</p>}

          {!fetching && rolls && rolls.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">
              No rolls yet. Go spin the reel!
            </Card>
          )}

          {rolls && rolls.length > 0 && (
            <Accordion type="single" collapsible className="grid gap-3">
              {rolls.map((roll) => {
                const result = results[roll.id];
                return (
                  <Card key={roll.id} className="px-4">
                    <AccordionItem value={roll.id} className="border-b-0">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {roll.item?.name ?? "Unknown item"}
                          </span>
                          {roll.item?.rarity && (
                            <Badge
                              className={`${RARITY_COLORS[roll.item.rarity] ?? ""} text-white border-transparent`}
                            >
                              {roll.item.rarity}
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {new Date(roll.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col gap-3 text-xs">
                          <SeedRow label="Server Seed" value={roll.serverSeed} />
                          <SeedRow label="Server Seed Hash" value={roll.serverSeedHash} />
                          <SeedRow label="Client Seed" value={roll.clientSeed} />

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verify(roll)}
                            disabled={verifying === roll.id}
                            className="self-start"
                          >
                            {verifying === roll.id
                              ? "Verifying..."
                              : result
                                ? "Re-verify"
                                : "Verify This Roll"}
                          </Button>

                          {result && (
                            <div className="flex flex-col gap-2 rounded border p-3 bg-muted/50">
                              <Check
                                label="SHA-256(serverSeed) matches commitment"
                                pass={result.hashValid}
                              />
                              <div className="text-muted-foreground font-mono break-all">
                                Computed: {result.computedHash}
                              </div>
                              <Check
                                label={`HMAC rollValue: ${result.rollValue.toFixed(10)}`}
                                pass
                              />
                              <Check
                                label={`Winner: ${result.computedWinnerName} (id ${result.computedWinnerId})`}
                                pass={result.matchesServer}
                              />
                              <div className="border-t pt-2 mt-1">
                                <Check
                                  label="Outcome verified"
                                  pass={result.hashValid && result.matchesServer}
                                  bold
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                );
              })}
            </Accordion>
          )}
        </div>
      </div>

      <EditProfileModal open={isEditing} onClose={() => setIsEditing(false)} />
      <ChangePasswordModal open={isChangingPassword} onClose={() => setIsChangingPassword(false)} />
    </div>
  );
}

function SeedRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <code className="font-mono break-all select-all text-foreground">
        {value ?? "—"}
      </code>
    </div>
  );
}

function Check({ label, pass, bold }: { label: string; pass: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${bold ? "font-semibold" : ""}`}>
      <span className={pass ? "text-green-400" : "text-red-400"}>
        {pass ? "\u2713" : "\u2717"}
      </span>
      <span className={pass ? "text-green-300" : "text-red-300"}>{label}</span>
    </div>
  );
}

const EditProfileModal = (props: { open: boolean; onClose: () => void }) => {
  const user = useUser(api);
  const {
    register,
    submit,
    formState: { isSubmitting },
  } = useActionForm(api.user.update, {
    defaultValues: user,
    onSuccess: props.onClose,
    send: ["firstName", "lastName"],
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5">
            <div className="grid w-full max-w-sm items-center gap-3">
              <Label>First Name</Label>
              <Input placeholder="First name" {...register("firstName")} />
            </div>
            <div className="grid w-full max-w-sm items-center gap-3">
              <Label>Last Name</Label>
              <Input placeholder="Last name" {...register("lastName")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={props.onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ChangePasswordModal = (props: { open: boolean; onClose: () => void }) => {
  const user = useUser(api);
  const {
    register,
    submit,
    reset,
    formState: { errors, isSubmitting },
  } = useActionForm(api.user.changePassword, {
    defaultValues: user,
    onSuccess: props.onClose,
  });

  const onClose = () => {
    reset();
    props.onClose();
  };

  return (
    <Dialog open={props.open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5">
            <div className="grid w-full max-w-sm items-center gap-3">
              <Label>Current Password</Label>
              <Input type="password" autoComplete="off" {...register("currentPassword")} />
              {errors?.root?.message && <p className="text-red-500 text-sm mt-1">{errors.root.message}</p>}
            </div>
            <div className="grid w-full max-w-sm items-center gap-3">
              <Label>New Password</Label>
              <Input type="password" autoComplete="off" {...register("newPassword")} />
              {errors?.user?.password?.message && (
                <p className="text-red-500 text-sm mt-1">New password {errors.user.password.message}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
