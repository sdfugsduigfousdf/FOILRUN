import { dealAbilities, luckFor, roundOpenTime, type AbilityId, type Settings } from "./settings";
import type { NetMsg } from "./protocol";
import { RaceSim } from "./sim";
import { generateTrack } from "./track";

export interface RoundState {
  id: number;
  options: AbilityId[];
  openedAt: number;
  expires: number;
  picked: AbilityId | null;
  result: { win: boolean; luck: number } | null;
  cpu: boolean;
}

export type RaceKind = "solo-drive" | "solo-scratch" | "net-drive" | "net-watch";

export class Director {
  readonly sim: RaceSim;
  readonly simulate: boolean;
  readonly humanScratch: boolean;
  readonly cpuScratch: boolean;
  round: RoundState | null = null;
  roundIndex = 0;
  over: { survived: boolean; time: number } | null = null;
  pending: NetMsg[] = [];
  rev = 0;
  remote: Extract<NetMsg, { k: "car" }> | null = null;
  private cpuAt = 0;
  private sentOver = false;

  constructor(
    readonly settings: Settings,
    readonly kind: RaceKind,
    opts: { humanScratch: boolean; cpuScratch: boolean },
  ) {
    this.sim = new RaceSim(generateTrack(settings.seed, settings.density), settings);
    this.sim.ai = kind === "solo-scratch";
    this.simulate = kind !== "net-watch";
    this.humanScratch = opts.humanScratch;
    this.cpuScratch = opts.cpuScratch;
  }

  private touch() {
    this.rev += 1;
  }

  pick(ability: AbilityId) {
    const round = this.round;
    if (!round || round.picked || round.result) return;
    if (!round.options.includes(ability)) return;
    round.picked = ability;
    this.touch();
  }

  /** Human scratcher finished the foil, or the CPU's timer did. */
  revealNow() {
    const round = this.round;
    if (!round || !round.picked || round.result) return;
    if (this.simulate) this.resolve(round.picked, false);
    else this.pending.push({ k: "reveal", id: round.id, ability: round.picked });
  }

  onNet(msg: NetMsg) {
    if (msg.k === "round" && !this.simulate) {
      this.round = {
        id: msg.id,
        options: msg.options,
        openedAt: msg.openedAt,
        expires: msg.expires,
        picked: null,
        result: null,
        cpu: false,
      };
      this.roundIndex = msg.id + 1;
      this.touch();
    } else if (msg.k === "reveal" && this.simulate) {
      const round = this.round;
      if (!round || round.id !== msg.id || round.result) return;
      if (!round.options.includes(msg.ability)) return;
      round.picked = msg.ability;
      this.resolve(msg.ability, false);
    } else if (msg.k === "result" && !this.simulate) {
      const round = this.round;
      if (!round || round.id !== msg.id) return;
      round.picked = msg.ability;
      round.result = { win: msg.win, luck: msg.luck };
      this.touch();
    } else if (msg.k === "over" && !this.simulate) {
      this.over = { survived: msg.survived, time: msg.time };
      this.touch();
    } else if (msg.k === "car" && !this.simulate) {
      this.remote = msg;
    }
  }

  frame(dt: number) {
    if (this.simulate && !this.over) {
      this.sim.step(dt);
      this.maybeOpen();
      this.maybeCpu();
      this.maybeExpire();
      this.maybeOver();
    }
  }

  private maybeOpen() {
    if (this.over) return;
    if (this.round && !this.round.result) return;
    if (this.roundIndex >= 6) return;
    const open = roundOpenTime(this.roundIndex, this.settings.scratchEvery);
    if (this.sim.time < open) return;
    const window = Math.min(11, Math.max(6, this.settings.scratchEvery - 4));
    const id = this.roundIndex;
    this.roundIndex += 1;
    const options = dealAbilities(this.settings.seed, id);
    this.round = {
      id,
      options,
      openedAt: this.sim.time,
      expires: this.sim.time + window,
      picked: null,
      result: null,
      cpu: !this.humanScratch,
    };
    this.cpuAt = this.sim.time + 1.3 + (id % 3) * 0.35;
    this.pending.push({
      k: "round",
      id,
      options,
      openedAt: this.round.openedAt,
      expires: this.round.expires,
    });
    this.touch();
  }

  private maybeCpu() {
    const round = this.round;
    if (!round || round.result || this.humanScratch) return;
    if (this.sim.time < this.cpuAt) return;
    if (!this.cpuScratch) return;
    const ability = round.options[Math.floor(Math.random() * round.options.length)]!;
    round.picked = ability;
    this.resolve(ability, false);
  }

  private maybeExpire() {
    const round = this.round;
    if (!round || round.result) return;
    if (this.sim.time < round.expires) return;
    const ability = round.picked ?? round.options[Math.floor(Math.random() * round.options.length)]!;
    round.picked = ability;
    this.resolve(ability, true);
  }

  private resolve(ability: AbilityId, forcedLoss: boolean) {
    const round = this.round;
    if (!round || round.result) return;
    const luck = luckFor(this.sim.speed, this.settings);
    const win = forcedLoss ? false : Math.random() < luck;
    round.result = { win, luck };
    this.sim.applyTicket(round.id, ability, win, luck);
    this.pending.push({ k: "result", id: round.id, ability, win, luck });
    this.touch();
  }

  private maybeOver() {
    if (this.sentOver) return;
    if (!this.sim.dead && !this.sim.finished) return;
    this.sentOver = true;
    this.over = { survived: this.sim.finished && !this.sim.dead, time: this.sim.time };
    this.pending.push({ k: "over", survived: this.over.survived, time: this.over.time });
    this.touch();
  }

  carMessage(): Extract<NetMsg, { k: "car" }> {
    return {
      k: "car",
      x: this.sim.x,
      z: this.sim.z,
      yaw: this.sim.yaw,
      speed: this.sim.speed,
      time: this.sim.time,
      luck: this.sim.luck(),
      s: this.sim.s,
      dead: this.sim.dead,
      finished: this.sim.finished,
    };
  }

  pose() {
    if (!this.simulate) {
      const r = this.remote;
      if (!r) {
        return {
          x: this.sim.x,
          z: this.sim.z,
          yaw: this.sim.yaw,
          speed: 0,
          time: 0,
          luck: this.settings.baseLuck,
          s: this.sim.s,
          dead: false,
          finished: false,
          shake: 0,
        };
      }
      return {
        x: r.x,
        z: r.z,
        yaw: r.yaw,
        speed: r.speed,
        time: r.time,
        luck: r.luck,
        s: r.s,
        dead: r.dead,
        finished: r.finished,
        shake: r.dead ? 1 : 0,
      };
    }
    return {
      x: this.sim.x,
      z: this.sim.z,
      yaw: this.sim.yaw,
      speed: this.sim.speed,
      time: this.sim.time,
      luck: this.sim.luck(),
      s: this.sim.s,
      dead: this.sim.dead,
      finished: this.sim.finished,
      shake: this.sim.shake,
    };
  }
}
