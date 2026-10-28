import type { AbilityId, Settings } from "./settings";

export type Phase = "lobby" | "race" | "result";

export type NetMsg =
  | { k: "hello"; name: string }
  | { k: "full" }
  | {
      k: "state";
      settings: Settings;
      runnerId: string | null;
      scratcherId: string | null;
      phase: Phase;
      hostId: string;
    }
  | { k: "claim"; role: "runner" | "scratcher" | "none" }
  | { k: "chat"; id: string; name: string; text: string }
  | { k: "start"; settings: Settings; runnerId: string | null; scratcherId: string | null }
  | { k: "round"; id: number; options: AbilityId[]; openedAt: number; expires: number }
  | { k: "reveal"; id: number; ability: AbilityId }
  | {
      k: "result";
      id: number;
      ability: AbilityId;
      win: boolean;
      luck: number;
    }
  | {
      k: "car";
      x: number;
      z: number;
      yaw: number;
      speed: number;
      time: number;
      luck: number;
      s: number;
      dead: boolean;
      finished: boolean;
    }
  | { k: "over"; survived: boolean; time: number }
  | { k: "pit" };

export function isNetMsg(data: unknown): data is NetMsg {
  return typeof data === "object" && data !== null && "k" in data;
}
