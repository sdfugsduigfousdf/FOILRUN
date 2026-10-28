import { useEffect, useState } from "react";
import { textAllowed, voiceAllowed, type Settings } from "@/game/settings";
import { Button } from "@/components/ui/button";

export interface ListedLobby {
  code: string;
  hostName: string;
  title: string;
  players: number;
  status: string;
  names: string[];
  settings: Settings | null;
}

export function FindScreen({
  onBack,
  onJoin,
}: {
  onBack: () => void;
  onJoin: (code: string) => void;
}) {
  const [lobbies, setLobbies] = useState<ListedLobby[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/lobbies");
        if (!res.ok) throw new Error("bad");
        const body = (await res.json()) as { lobbies: ListedLobby[] };
        if (!stop) {
          setLobbies(body.lobbies);
          setError(null);
        }
      } catch {
        if (!stop) setError("The board didn't answer. Try again in a moment.");
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold">Public board</p>
          <h1 className="display text-6xl">Open heats</h1>
        </div>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </header>
      {error && <p className="text-sm text-oxide">{error}</p>}
      {lobbies && lobbies.length === 0 && (
        <div className="panel p-6">
          <p className="text-lg text-fg">Nobody has listed a heat.</p>
          <p className="mt-1 text-sm text-muted">List one from the front, or open a private room and share the code.</p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {(lobbies ?? []).map((lobby) => {
          const full = lobby.players >= 2;
          const comms = lobby.settings?.comms ?? "both";
          const line = !textAllowed(comms) && !voiceAllowed(comms) ? "Line shut" : comms === "both" ? "Text + voice" : comms === "text" ? "Text only" : "Voice only";
          return (
            <li key={lobby.code} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="display text-3xl">{lobby.title}</p>
                <p className="text-sm text-muted">
                  {lobby.hostName} · {lobby.players}/2 · clock {lobby.settings?.parTime ?? "—"}s · {line}
                </p>
              </div>
              <Button type="button" disabled={full} onClick={() => onJoin(lobby.code)}>
                {full ? "Full" : "Take a seat"}
              </Button>
            </li>
          );
        })}
      </ul>
      {lobbies === null && !error && <p className="text-muted">Checking the board…</p>}
    </main>
  );
}
