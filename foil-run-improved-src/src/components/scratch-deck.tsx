import { useEffect, useRef, useState } from "react";
import { ABILITIES, type AbilityId } from "@/game/settings";
import type { RoundState } from "@/game/director";

export function ScratchDeck({
  round,
  raceTime,
  human,
  onPick,
  onReveal,
}: {
  round: RoundState | null;
  raceTime: number;
  human: boolean;
  onPick: (id: AbilityId) => void;
  onReveal: () => void;
}) {
  const [scratched, setScratched] = useState(false);
  const roundId = round?.id ?? -1;
  useEffect(() => {
    setScratched(false);
  }, [roundId]);

  if (!round) {
    return (
      <div className="panel p-4">
        <p className="eyebrow">Foil</p>
        <p className="mt-1 text-lg text-fg">Next ticket is still warming.</p>
        <p className="text-sm text-muted">Go faster. Luck climbs with speed and never quite hits certain.</p>
      </div>
    );
  }

  const left = Math.max(0, round.expires - raceTime);
  const expired = raceTime >= round.expires;
  const showResult = Boolean(round.result) && (scratched || !human || expired);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <p className="eyebrow">{human ? "Your foil" : "Foil in play"}</p>
        <p className="display tabular-nums text-3xl text-gold">{left.toFixed(1)}</p>
      </div>

      {!round.picked && human && (
        <div className="grid gap-2 sm:grid-cols-3">
          {round.options.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="ticket min-h-24 px-4 py-3 text-left"
            >
              <span className="display block text-3xl text-gold">{ABILITIES[id].name}</span>
              <span className="mt-1 block text-sm text-muted">{ABILITIES[id].blurb}</span>
            </button>
          ))}
        </div>
      )}

      {!round.picked && !human && (
        <p className="text-sm text-muted">
          Three abilities are up
          {round.cpu ? " — the CPU is scratching." : "."}{" "}
          {round.options.map((id) => ABILITIES[id].name).join(" · ")}
        </p>
      )}

      {round.picked && !showResult && human && (
        <FoilPad
          title={ABILITIES[round.picked].name}
          hidden={!round.result}
          result={round.result}
          onDone={() => {
            setScratched(true);
            if (!round.result) onReveal();
          }}
        />
      )}

      {round.picked && !showResult && !human && (
        <p className="text-fg">
          Scratching <span className="text-gold">{ABILITIES[round.picked].name}</span>
          …
        </p>
      )}

      {showResult && round.picked && round.result && (
        <div className={round.result.win ? "ticket px-4 py-4" : "ticket px-4 py-4"}>
          <p className="eyebrow">{round.result.win ? "Hit" : "Bust"}</p>
          <p className={round.result.win ? "display text-5xl text-gold" : "display text-5xl text-oxide"}>
            {ABILITIES[round.picked].name}
          </p>
          <p className="mt-2 text-fg">
            {round.result.win ? ABILITIES[round.picked].blurb : ABILITIES[round.picked].curse}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">
            Luck on the reveal {Math.round(round.result.luck * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}

function FoilPad({
  title,
  hidden,
  result,
  onDone,
}: {
  title: string;
  hidden: boolean;
  result: { win: boolean; luck: number } | null;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#8a6420");
    grad.addColorStop(0.45, "#f0d090");
    grad.addColorStop(1, "#8a6420");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#100e0c";
    ctx.font = "600 42px Teko, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title.toUpperCase(), canvas.width / 2, canvas.height / 2 - 6);
    ctx.font = "600 16px Outfit, sans-serif";
    ctx.fillText("SCRATCH THE FOIL", canvas.width / 2, canvas.height / 2 + 28);
    done.current = false;
  }, [title]);

  function paint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || done.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 64) {
      total += 1;
      if (data[i]! < 32) clear += 1;
    }
    if (total > 0 && clear / total > 0.4) {
      done.current = true;
      onDone();
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-line">
      <div className="flex min-h-36 flex-col items-center justify-center px-4 py-6 text-center">
        <p className="eyebrow">{hidden ? "Under the foil" : result?.win ? "Hit" : "Bust"}</p>
        <p className={result && !result.win ? "display text-5xl text-oxide" : "display text-5xl text-gold"}>
          {hidden ? "???" : result?.win ? "MIRACLE" : "INVERTED"}
        </p>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={240}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          paint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1 && e.pointerType === "mouse") return;
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          paint(e.clientX, e.clientY);
        }}
      />
    </div>
  );
}
