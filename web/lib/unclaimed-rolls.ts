const STORAGE_KEY = "unclaimedRolls";

export interface UnclaimedRoll {
  id: string;
  name: string;
  rarity: string;
  rolledAt: string;
}

export function getUnclaimedRolls(): UnclaimedRoll[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addUnclaimedRoll(roll: UnclaimedRoll): UnclaimedRoll[] {
  const rolls = getUnclaimedRolls();
  rolls.unshift(roll); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rolls));
  return rolls;
}

export function clearUnclaimedRolls(): void {
  localStorage.removeItem(STORAGE_KEY);
}
