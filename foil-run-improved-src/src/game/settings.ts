import { z } from "zod";

export const TRACK_LENGTH = 3400;

export const ABILITIES = {
  nitro: {
    name: "Nitro",
    blurb: "A hard shove of speed.",
    curse: "The shove hits backwards.",
  },
  feather: {
    name: "Feather",
    blurb: "The engine breathes. Pull climbs.",
    curse: "The engine goes thick and lazy.",
  },
  ghost: {
    name: "Ghost",
    blurb: "Phase through the junk and the dirt.",
    curse: "Hits land heavier and closer.",
  },
  clock: {
    name: "Clock nick",
    blurb: "Steal seconds off the death clock.",
    curse: "The clock takes those seconds back, with interest.",
  },
  grip: {
    name: "Grip",
    blurb: "The nose answers faster.",
    curse: "The wheel goes numb.",
  },
  shrink: {
    name: "Shrink",
    blurb: "The car tucks in.",
    curse: "The car swells into everything.",
  },
  tailwind: {
    name: "Tailwind",
    blurb: "A push that stays on your back.",
    curse: "A headwind pins you down.",
  },
  slick: {
    name: "Clean tires",
    blurb: "Oil stops mattering.",
    curse: "The tires soap up anyway.",
  },
} as const;

export type AbilityId = keyof typeof ABILITIES;
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];

export const settingsSchema = z.object({
  title: z.string().trim().min(1).max(40),
  launchSpeed: z.number().min(0).max(40),
  engine: z.number().min(4).max(16),
  baseLuck: z.number().min(0.02).max(0.45),
  luckGain: z.number().min(0.08).max(0.7),
  parTime: z.number().min(12).max(90),
  scratchEvery: z.number().min(8).max(25),
  density: z.enum(["lean", "thick", "brutal"]),
  comms: z.enum(["off", "text", "voice", "both"]),
  seed: z.number().int().min(1).max(999999),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Density = Settings["density"];
export type Comms = Settings["comms"];

export function defaultSettings(title = "Midnight heat"): Settings {
  return {
    title,
    launchSpeed: 14,
    engine: 7.5,
    baseLuck: 0.12,
    luckGain: 0.36,
    parTime: 24,
    scratchEvery: 15,
    density: "thick",
    comms: "both",
    seed: 4821,
  };
}

/** Seconds a perfectly straight, empty road would take. No positive speed cap. */
export function cleanLineSeconds(s: Pick<Settings, "engine" | "launchSpeed">): number {
  const a = Math.max(0.5, s.engine);
  const v = Math.max(0, s.launchSpeed);
  const disc = v * v + 2 * a * TRACK_LENGTH;
  return (-v + Math.sqrt(disc)) / a;
}

export function luckFor(speed: number, s: Pick<Settings, "baseLuck" | "luckGain">): number {
  const heat = Math.max(0, speed) / 32;
  return Math.min(0.9, Math.max(0.03, s.baseLuck + heat * s.luckGain));
}

export function roundOpenTime(index: number, every: number): number {
  const first = Math.min(5, every * 0.45);
  return first + index * every;
}

export function dealAbilities(seed: number, round: number): AbilityId[] {
  const rand = mulberry(seed * 997 + round * 131);
  const pool = [...ABILITY_IDS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, 3);
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function textAllowed(comms: Comms) {
  return comms === "text" || comms === "both";
}

export function voiceAllowed(comms: Comms) {
  return comms === "voice" || comms === "both";
}

export function makeCode() {
  const alph = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i += 1) s += alph[Math.floor(Math.random() * alph.length)];
  return s;
}
