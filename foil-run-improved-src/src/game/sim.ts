import { luckFor, type AbilityId, type Settings } from "./settings";
import { clamp, wrapAngle } from "./rng";
import { poseOnTrack, project, type Track } from "./track";

export interface ActiveEffect {
  id: AbilityId;
  win: boolean;
  until: number;
}

export interface TicketLog {
  id: number;
  ability: AbilityId;
  win: boolean;
  luck: number;
  at: number;
}

const TURN = 2.55;

/**
 * Forward speed is intentionally uncapped. Obstacles, walls, and sand are
 * what bleed it. A tiny reverse floor only stops a curse from running away.
 */
export class RaceSim {
  x = 0;
  z = 0;
  yaw = 0;
  speed = 0;
  time = 0;
  s = 0;
  hint = 0;
  dead = false;
  finished = false;
  effects: ActiveEffect[] = [];
  log: TicketLog[] = [];
  keys = new Set<string>();
  ai = false;
  oiled = 0;
  shake = 0;
  bannerId = 0;
  banner = "";
  bannerGood = false;
  bannerAt = -10;
  private hitUntil = new Map<number, number>();

  constructor(
    readonly track: Track,
    readonly settings: Settings,
  ) {
    const start = poseOnTrack(track, 8, 0);
    this.x = start.x;
    this.z = start.z;
    this.yaw = start.yaw;
    this.speed = settings.launchSpeed;
    this.s = 8;
  }

  setKeys(codes: string[]) {
    this.keys = new Set(codes);
  }

  getYaw() {
    return this.yaw;
  }

  getSpeed() {
    return this.speed;
  }

  luck() {
    return luckFor(this.speed, this.settings);
  }

  radius() {
    let r = 1.05;
    for (const e of this.effects) {
      if (e.id === "shrink") r *= e.win ? 0.5 : 1.8;
    }
    return r;
  }

  private ghost() {
    return this.effects.some((e) => e.id === "ghost" && e.win);
  }

  private heavy() {
    return this.effects.some((e) => e.id === "ghost" && !e.win);
  }

  private gripMul() {
    let g = 1;
    for (const e of this.effects) {
      if (e.id === "grip") g *= e.win ? 1.55 : 0.4;
    }
    return g;
  }

  step(dt: number) {
    if (this.dead || this.finished) {
      this.speed *= Math.exp(-2.2 * dt);
      this.shake = Math.max(0, this.shake - dt);
      return;
    }
    const dist = Math.abs(this.speed) * dt;
    const parts = Math.max(1, Math.min(10, Math.ceil(dist / 0.85)));
    const h = dt / parts;
    for (let i = 0; i < parts; i += 1) this.integrate(h);
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  private integrate(dt: number) {
    this.time += dt;
    this.effects = this.effects.filter((e) => e.until > this.time);
    if (this.oiled > 0) this.oiled -= dt;

    const throttle =
      this.ai ||
      this.keys.has("KeyW") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("Space");
    const brake = !this.ai && (this.keys.has("KeyS") || this.keys.has("ArrowDown"));

    let accel = this.settings.engine;
    for (const e of this.effects) {
      if (e.id === "feather") accel *= e.win ? 1.75 : 0.4;
      if (e.id === "tailwind") accel += e.win ? 14 : -11;
    }
    if (throttle && accel > 0) this.speed += accel * dt;
    else if (throttle && accel < 0) this.speed += accel * dt;
    else if (!brake) this.speed -= Math.sign(this.speed) * 1.6 * dt;
    if (brake) {
      const next = this.speed - Math.sign(this.speed || 1) * 34 * dt;
      this.speed = Math.sign(this.speed) === Math.sign(next) || this.speed === 0 ? next : 0;
    }
    if (this.speed < -8) this.speed = -8;

    const proj = project(this.track, this.x, this.z, this.hint);
    this.hint = proj.index;
    this.s = proj.s;

    let steer = 0;
    if (this.ai) {
      const err = wrapAngle(proj.yaw - this.yaw);
      steer = clamp(-proj.lat / 4.2 + err * 1.15, -1, 1);
    } else {
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) steer += 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) steer -= 1;
    }

    const forcedSlip = this.effects.some((e) => e.id === "slick" && !e.win);
    const immune = this.effects.some((e) => e.id === "slick" && e.win);
    if ((this.oiled > 0 || forcedSlip) && !immune) {
      steer += Math.sin(this.time * 22) * 0.85;
      steer *= 0.55;
    }

    const reverse = this.speed >= 0 ? 1 : -1;
    const speedFactor = clamp(Math.abs(this.speed) / 16, 0.28, 1);
    const high = 1 / (1 + Math.max(0, Math.abs(this.speed) - 38) / 52);
    this.yaw += steer * TURN * speedFactor * high * reverse * this.gripMul() * dt;

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;

    const now = project(this.track, this.x, this.z, this.hint);
    this.hint = now.index;
    this.s = now.s;

    if (!this.ghost()) {
      const limit = now.half - this.radius() * 0.45;
      if (Math.abs(now.lat) > limit) {
        const sign = Math.sign(now.lat) || 1;
        const over = Math.abs(now.lat) - limit;
        const rx = Math.cos(now.yaw);
        const rz = -Math.sin(now.yaw);
        this.x -= rx * sign * over;
        this.z -= rz * sign * over;
        this.speed *= this.heavy() ? 0.9 : 0.955;
        if (over > 0.4) this.shake = Math.max(this.shake, 0.25);
      }
      if (Math.abs(now.lat) > now.half + 0.15) {
        const bleed = (this.heavy() ? 55 : 36) * dt;
        this.speed -= Math.sign(this.speed || 1) * bleed;
      }
    }

    this.collide(dt);
    if (this.time >= this.settings.parTime && this.s < this.track.length - 12) {
      this.dead = true;
      this.shake = 1.4;
      this.say("Flatlined", false);
    } else if (this.s >= this.track.length - 12) {
      this.finished = true;
      this.say("Cleared", true);
    }
  }

  private collide(dt: number) {
    const ghost = this.ghost();
    const heavy = this.heavy();
    const immune = this.effects.some((e) => e.id === "slick" && e.win);
    for (let i = 0; i < this.track.obstacles.length; i += 1) {
      const o = this.track.obstacles[i]!;
      if (Math.abs(o.s - this.s) > 28) continue;
      const lat =
        o.kind === "sweep" ? Math.sin(this.time * 1.35 + o.phase) * (this.track.width * 0.36) : o.lat * (this.track.width / 2);
      const p = poseOnTrack(this.track, o.s, lat);
      const dx = this.x - p.x;
      const dz = this.z - p.z;
      const rr = this.radius() + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr) continue;
      if (o.kind === "oil") {
        if (!immune) this.oiled = Math.max(this.oiled, 0.85);
        continue;
      }
      if (o.kind === "bump") {
        if ((this.hitUntil.get(i) ?? 0) > this.time) continue;
        this.hitUntil.set(i, this.time + 0.4);
        this.speed *= heavy ? 0.62 : 0.8;
        this.shake = Math.max(this.shake, 0.45);
        continue;
      }
      if (ghost) continue;
      const d = Math.sqrt(d2) || 0.001;
      const push = rr - d + 0.05;
      this.x += (dx / d) * push;
      this.z += (dz / d) * push;
      if ((this.hitUntil.get(i) ?? 0) > this.time) continue;
      this.hitUntil.set(i, this.time + 0.38);
      const keep = heavy ? 0.28 : 0.46;
      this.speed *= keep;
      this.shake = Math.max(this.shake, heavy ? 1 : 0.75);
      void dt;
    }
  }

  applyTicket(id: number, ability: AbilityId, win: boolean, luck: number) {
    this.log.push({ id, ability, win, luck, at: this.time });
    if (ability === "nitro") {
      if (win) this.speed += 30;
      else this.speed = Math.max(0, this.speed * 0.48 - 8);
    } else if (ability === "clock") {
      this.time = Math.max(0, this.time + (win ? -2.4 : 3.6));
    } else {
      const dur = ability === "ghost" || ability === "shrink" ? 6 : 7;
      this.effects = this.effects.filter((e) => e.id !== ability);
      this.effects.push({ id: ability, win, until: this.time + dur });
    }
    const name = ability.toUpperCase();
    this.say(win ? `${name} HIT` : `${name} CURSED`, win);
  }

  say(text: string, good: boolean) {
    this.bannerId += 1;
    this.banner = text;
    this.bannerGood = good;
    this.bannerAt = this.time;
  }
}
