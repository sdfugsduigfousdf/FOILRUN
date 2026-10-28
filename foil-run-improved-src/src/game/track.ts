import { TRACK_LENGTH, type Density } from "./settings";
import { mulberry32 } from "./rng";

export type ObstacleKind = "crate" | "sweep" | "oil" | "bump";

export interface TrackPoint {
  x: number;
  z: number;
  yaw: number;
  s: number;
  width: number;
}

export interface Obstacle {
  kind: ObstacleKind;
  s: number;
  lat: number;
  phase: number;
  radius: number;
}

export interface Track {
  points: TrackPoint[];
  obstacles: Obstacle[];
  spacing: number;
  length: number;
  width: number;
}

export function roadWidth(density: Density) {
  if (density === "lean") return 20;
  if (density === "brutal") return 13.2;
  return 16;
}

export function generateTrack(seed: number, density: Density): Track {
  const rand = mulberry32(seed);
  const spacing = 8;
  const width = roadWidth(density);
  const n = Math.round(TRACK_LENGTH / spacing);
  const points: TrackPoint[] = [];
  let x = 0;
  let z = 0;
  let yaw = 0;
  for (let i = 0; i <= n; i += 1) {
    const target = Math.sin(i * 0.021 + seed * 0.01) * 0.75 + Math.sin(i * 0.008) * 0.35;
    yaw += (target - yaw) * 0.075 + (rand() - 0.5) * 0.018;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (i > 0) {
      x += fx * spacing;
      z += fz * spacing;
    }
    points.push({ x, z, yaw, s: i * spacing, width });
  }

  const obstacles: Obstacle[] = [];
  const gap = density === "lean" ? 42 : density === "brutal" ? 16 : 26;
  let s = 140;
  let guard = 0;
  while (s < TRACK_LENGTH - 100 && guard < 400) {
    guard += 1;
    const roll = rand();
    const kind: ObstacleKind =
      roll < 0.52 ? "crate" : roll < 0.7 ? "sweep" : roll < 0.86 ? "oil" : "bump";
    const lat = (rand() * 2 - 1) * 0.62;
    obstacles.push({
      kind,
      s,
      lat: kind === "sweep" ? 0 : lat,
      phase: rand() * Math.PI * 2,
      radius: kind === "crate" ? 1.55 : kind === "sweep" ? 1.35 : kind === "oil" ? 2.1 : 1.7,
    });
    if ((kind === "crate" || kind === "sweep") && density !== "lean" && rand() < (density === "brutal" ? 0.38 : 0.16)) {
      obstacles.push({
        kind: "crate",
        s: s + 2,
        lat: lat > 0 ? -0.55 : 0.55,
        phase: 0,
        radius: 1.4,
      });
    }
    s += gap * (0.75 + rand() * 0.55);
  }

  return { points, obstacles, spacing, length: TRACK_LENGTH, width };
}

export interface Projection {
  index: number;
  s: number;
  lat: number;
  yaw: number;
  half: number;
  x: number;
  z: number;
}

export function project(track: Track, x: number, z: number, hint: number): Projection {
  const n = track.points.length;
  const clampedHint = Math.max(0, Math.min(n - 1, hint));
  let best = clampedHint;
  let bestD = Infinity;
  const scan = (a: number, b: number) => {
    for (let i = a; i <= b; i += 1) {
      const p = track.points[i]!;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  };
  scan(Math.max(0, clampedHint - 90), Math.min(n - 1, clampedHint + 90));
  if (bestD > 40 * 40) {
    bestD = Infinity;
    scan(0, n - 1);
  }
  const p = track.points[best]!;
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw);
  const rz = -Math.sin(p.yaw);
  const dx = x - p.x;
  const dz = z - p.z;
  return {
    index: best,
    s: p.s + dx * fx + dz * fz,
    lat: dx * rx + dz * rz,
    yaw: p.yaw,
    half: p.width / 2,
    x: p.x,
    z: p.z,
  };
}

export function poseOnTrack(track: Track, s: number, latMeters: number) {
  const spacing = track.spacing;
  const max = track.points.length - 1;
  const f = Math.max(0, Math.min(max, s / spacing));
  const i0 = Math.floor(f);
  const i1 = Math.min(max, i0 + 1);
  const t = f - i0;
  const a = track.points[i0]!;
  const b = track.points[i1]!;
  const yaw = a.yaw;
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return { x: x + rx * latMeters, z: z + rz * latMeters, yaw, width: a.width };
}
