import { cleanLineSeconds, type Comms, type Density, type Settings } from "@/game/settings";

const COMMS: { id: Comms; label: string }[] = [
  { id: "off", label: "Shut" },
  { id: "text", label: "Text" },
  { id: "voice", label: "Voice" },
  { id: "both", label: "Both" },
];

const DENSITY: { id: Density; label: string }[] = [
  { id: "lean", label: "Lean" },
  { id: "thick", label: "Thick" },
  { id: "brutal", label: "Brutal" },
];

export function SettingsForm({
  value,
  onChange,
  locked = false,
}: {
  value: Settings;
  onChange: (next: Settings) => void;
  locked?: boolean;
}) {
  const floor = cleanLineSeconds(value);
  const gap = floor - value.parTime;
  const set = (patch: Partial<Settings>) => onChange({ ...value, ...patch });

  return (
    <fieldset disabled={locked} className="flex flex-col gap-4 disabled:opacity-60">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Heat name</span>
        <input
          value={value.title}
          maxLength={40}
          onChange={(e) => set({ title: e.target.value || "Heat" })}
          className="h-12 rounded-lg border border-line bg-bg px-3 text-fg"
        />
      </label>

      <Slider
        label="Base speed"
        hint={`${Math.round(value.launchSpeed)} m/s off the line`}
        min={0}
        max={40}
        step={1}
        value={value.launchSpeed}
        onChange={(launchSpeed) => set({ launchSpeed })}
      />
      <Slider
        label="Engine pull"
        hint="No top speed. This is how hard it climbs."
        min={4}
        max={16}
        step={0.5}
        value={value.engine}
        onChange={(engine) => set({ engine })}
      />
      <Slider
        label="Base luck"
        hint={`${Math.round(value.baseLuck * 100)}% even when the car is crawling`}
        min={0.02}
        max={0.45}
        step={0.01}
        value={value.baseLuck}
        onChange={(baseLuck) => set({ baseLuck })}
      />
      <Slider
        label="Luck from speed"
        hint="Added as the car passes 32 m/s, capped at 90%"
        min={0.08}
        max={0.7}
        step={0.02}
        value={value.luckGain}
        onChange={(luckGain) => set({ luckGain })}
      />
      <Slider
        label="Death clock"
        hint={`${value.parTime.toFixed(1)}s`}
        min={12}
        max={90}
        step={0.5}
        value={value.parTime}
        onChange={(parTime) => set({ parTime })}
      />
      <p className={gap > 0.4 ? "text-sm text-gold" : "text-sm text-oxide"}>
        {gap > 0.4
          ? `A perfect empty road still needs ${floor.toFixed(1)}s. This clock is ${gap.toFixed(1)}s short — foil is the only way under it.`
          : `A perfect empty road is about ${floor.toFixed(1)}s. This clock is soft enough to clear without a ticket.`}
      </p>
      <Slider
        label="Scratch every"
        hint={`${value.scratchEvery}s — first ticket opens early so the car can get hot`}
        min={8}
        max={25}
        step={1}
        value={value.scratchEvery}
        onChange={(scratchEvery) => set({ scratchEvery })}
      />

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Debris</span>
        <div className="grid grid-cols-3 gap-2">
          {DENSITY.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => set({ density: d.id })}
              className={
                value.density === d.id
                  ? "h-11 rounded-lg bg-gold text-sm font-semibold text-bg"
                  : "h-11 rounded-lg border border-line bg-bg text-sm font-semibold text-fg"
              }
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">Line between seats</span>
        <div className="grid grid-cols-4 gap-2">
          {COMMS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set({ comms: c.id })}
              className={
                value.comms === c.id
                  ? "h-11 rounded-lg bg-gold text-sm font-semibold text-bg"
                  : "h-11 rounded-lg border border-line bg-bg text-sm font-semibold text-fg"
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">Shut, text only, voice only, or both. Guests follow the host.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Course <span className="tabular-nums text-fg">{value.seed}</span>
        </p>
        <button
          type="button"
          className="h-11 rounded-lg border border-line px-3 text-sm font-semibold text-fg"
          onClick={() => set({ seed: 1 + Math.floor(Math.random() * 999998) })}
        >
          Reshuffle course
        </button>
      </div>
    </fieldset>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">{label}</span>
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-sm text-muted">{hint}</span>
    </label>
  );
}
