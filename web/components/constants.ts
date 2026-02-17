export const CARD_WIDTH = 80;
export const CARD_HEIGHT = 120;

export const SNAP_AREA_WIDTH = 200;
export const SNAP_AREA_HEIGHT = 300;

// --- Gacha Reel ---

export enum Rarity {
  Common = "Common",
  Rare = "Rare",
  Epic = "Epic",
  Legendary = "Legendary",
}

export interface ReelItem {
  id: string;
  name: string;
  rarity: Rarity;
  color: number;
}

export interface RarityConfig {
  bgColor: number;
  glowColor: number;
  glowAlpha: number;
  label: string;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  [Rarity.Common]: {
    bgColor: 0x4a5568,
    glowColor: 0x718096,
    glowAlpha: 0.3,
    label: "Common",
  },
  [Rarity.Rare]: {
    bgColor: 0x2b6cb0,
    glowColor: 0x63b3ed,
    glowAlpha: 0.5,
    label: "Rare",
  },
  [Rarity.Epic]: {
    bgColor: 0x6b46c1,
    glowColor: 0xb794f4,
    glowAlpha: 0.6,
    label: "Epic",
  },
  [Rarity.Legendary]: {
    bgColor: 0xc05621,
    glowColor: 0xfbd38d,
    glowAlpha: 0.8,
    label: "Legendary",
  },
};

export const PLACEHOLDER_ITEMS: ReelItem[] = [
  { id: "1", name: "Iron Sword", rarity: Rarity.Common, color: 0x8b9dad },
  { id: "2", name: "Wooden Shield", rarity: Rarity.Common, color: 0x8b7355 },
  { id: "3", name: "Health Potion", rarity: Rarity.Common, color: 0xc94040 },
  { id: "4", name: "Mana Crystal", rarity: Rarity.Rare, color: 0x4a90d9 },
  { id: "5", name: "Shadow Cloak", rarity: Rarity.Rare, color: 0x3d3d5c },
  { id: "6", name: "Flame Ring", rarity: Rarity.Rare, color: 0xd9534f },
  { id: "7", name: "Thunder Staff", rarity: Rarity.Epic, color: 0x9b59b6 },
  { id: "8", name: "Dragon Scale", rarity: Rarity.Epic, color: 0x27ae60 },
  { id: "9", name: "Void Amulet", rarity: Rarity.Epic, color: 0x2c3e50 },
  { id: "10", name: "Excalibur", rarity: Rarity.Legendary, color: 0xf1c40f },
  { id: "11", name: "Phoenix Wing", rarity: Rarity.Legendary, color: 0xe74c3c },
  { id: "12", name: "Crown of Ages", rarity: Rarity.Legendary, color: 0xf39c12 },
];

export const REEL_ITEM_WIDTH = 200;
export const REEL_ITEM_HEIGHT = 200;

// Timing (seconds)
export const SPIN_SPEED = 2400; // pixels per second during constant spin
export const SPIN_DURATION = 1.5;
export const DECEL_DURATION = 2.0;
export const LANDING_DURATION = 0.8;
