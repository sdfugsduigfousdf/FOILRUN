import { useEffect, useRef, useState } from "react";
import { textAllowed, voiceAllowed, type Settings } from "@/game/settings";
import { isNetMsg, type Phase } from "@/game/protocol";
import { useFoilNet } from "@/game/use-foil-net";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/settings-form";
import { ChatDock, type ChatLine } from "@/components/chat-dock";
import { RaceScreen } from "@/components/race-screen";

export function RoomScreen({
  code,
  name,
  hosting,
  isPublic,
  initial,
  hostPeer,
  onLeave,
}: {
  code: string;
  name: string;
  hosting: boolean;
  isPublic: boolean;
  initial: Settings;
  hostPeer: string;
  onLeave: () => void;
}) {
  const net = useFoilNet(code, name, hosting ? hostPeer : undefined);
  const [settings, setSettings] = useState(initial);
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [scratcherId, setScratcherId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [booted, setBooted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const voiceRef = useRef<MediaStream | null>(null);
  const settingsRef = useRef(settings);
  const runnerRef = useRef(runnerId);
  const scratchRef = useRef(scratcherId);
  const phaseRef = useRef(phase);
  const peersRef = useRef(net.peers);
  settingsRef.current = settings;
  runnerRef.current = runnerId;
  scratchRef.current = scratcherId;
  phaseRef.current = phase;
  peersRef.current = net.peers;

  useEffect(() => {
    return net.onMessage((from, data, channel) => {
      if (channel !== "reliable" || !isNetMsg(data)) return;
      if (data.k === "hello" && hosting) {
        if (peersRef.current.length >= 2) {
          net.send({ k: "full" }, from);
          return;
        }
        net.send(
          {
            k: "state",
            settings: settingsRef.current,
            runnerId: runnerRef.current,
            scratcherId: scratchRef.current,
            phase: phaseRef.current,
            hostId: net.selfId,
          },
          from,
        );
      } else if (data.k === "full") {
        setBooted(true);
      } else if (data.k === "state" && !hosting) {
        const parsed = data.settings;
        setSettings(parsed);
        setRunnerId(data.runnerId);
        setScratcherId(data.scratcherId);
        setPhase(data.phase === "race" ? "race" : data.phase === "lobby" ? "lobby" : phaseRef.current);
      } else if (data.k === "claim" && hosting) {
        setRunnerId((current) => {
          if (data.role === "runner") return current && current !== from ? current : from;
          return current === from ? null : current;
        });
        setScratcherId((current) => {
          if (data.role === "scratcher") return current && current !== from ? current : from;
          return current === from ? null : current;
        });
      } else if (data.k === "chat" && textAllowed(settingsRef.current.comms)) {
        setChat((lines) => [...lines, { id: data.id, name: data.name, text: data.text }].slice(-80));
      } else if (data.k === "start" && !hosting) {
        setSettings(data.settings);
        setRunnerId(data.runnerId);
        setScratcherId(data.scratcherId);
        setRunId((n) => n + 1);
        setPhase("race");
      } else if (data.k === "pit") {
        if (hosting || from) setPhase("lobby");
      }
    });
  }, [hosting, net.onMessage, net.send, net.selfId]);

  useEffect(() => {
    if (!net.joined) return;
    net.send({ k: "hello", name });
  }, [net.joined, net.send, name]);

  useEffect(() => {
    if (!hosting) return;
    net.send({
      k: "state",
      settings,
      runnerId,
      scratcherId,
      phase,
      hostId: net.selfId,
    });
  }, [hosting, net.send, net.selfId, settings, runnerId, scratcherId, phase]);

  useEffect(() => {
    if (!hosting) return;
    const beat = () => {
      void fetch("/api/lobbies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "upsert",
          code,
          hostPeer: net.selfId,
          hostName: name,
          title: settingsRef.current.title,
          isPublic,
          settings: settingsRef.current,
          players: Math.min(8, 1 + peersRef.current.length),
          status: phaseRef.current === "race" ? "racing" : "open",
          names: [name, ...peersRef.current.map((p) => p.name || "Seat")],
        }),
      });
    };
    beat();
    const id = window.setInterval(beat, 3000);
    return () => {
      window.clearInterval(id);
      void fetch("/api/lobbies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "close", code, hostPeer: net.selfId }),
        keepalive: true,
      });
    };
  }, [hosting, code, name, net.selfId, isPublic]);

  useEffect(() => {
    if (voiceAllowed(settings.comms)) return;
    voiceRef.current?.getTracks().forEach((t) => t.stop());
    voiceRef.current = null;
    net.setLocalVoice(null);
    setVoiceOn(false);
  }, [settings.comms, net.setLocalVoice]);

  function claim(role: "runner" | "scratcher" | "none") {
    if (hosting) {
      const from = net.selfId;
      setRunnerId((current) => {
        if (role === "runner") return current && current !== from ? current : from;
        return current === from ? null : current;
      });
      setScratcherId((current) => {
        if (role === "scratcher") return current && current !== from ? current : from;
        return current === from ? null : current;
      });
    } else {
      net.send({ k: "claim", role });
    }
  }

  function sendChat(text: string) {
    if (!textAllowed(settings.comms)) return;
    const line = { id: `${net.selfId}-${Date.now()}`, name, text: text.slice(0, 180) };
    setChat((lines) => [...lines, line].slice(-80));
    net.send({ k: "chat", ...line });
  }

  async function toggleVoice() {
    if (!voiceAllowed(settings.comms)) return;
    if (voiceRef.current) {
      voiceRef.current.getTracks().forEach((t) => t.stop());
      voiceRef.current = null;
      net.setLocalVoice(null);
      setVoiceOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      voiceRef.current = stream;
      net.setLocalVoice(stream);
      setVoiceOn(true);
      setVoiceError(null);
    } catch {
      setVoiceError("Mic stayed shut. Allow the microphone, or keep the line on text.");
    }
  }

  function start() {
    if (!runnerId) return;
    const payload = {
      k: "start" as const,
      settings,
      runnerId,
      scratcherId,
    };
    net.send(payload);
    setRunId((n) => n + 1);
    setPhase("race");
  }

  const seats = [
    { id: net.selfId, name, state: "you" as const },
    ...net.peers.map((p) => ({ id: p.id, name: p.name || "Seat", state: p.connectionState })),
  ];

  const streams = Object.entries(net.streams).map(([id, stream]) => ({ id, stream }));

  if (booted) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
        <h1 className="display text-6xl">Heat is full</h1>
        <p className="text-muted">Two seats only. Find another table or open your own.</p>
        <Button type="button" onClick={onLeave}>
          Back
        </Button>
      </main>
    );
  }

  return (
    <div className="relative min-h-dvh">
      {phase === "race" ? (
        <RaceScreen
          key={runId}
          settings={settings}
          kind={runnerId === net.selfId ? "net-drive" : "net-watch"}
          humanScratch={scratcherId === net.selfId}
          cpuScratch={runnerId === net.selfId && !scratcherId}
          net={net}
          onExit={onLeave}
          onPit={() => {
            net.send({ k: "pit" });
            setPhase("lobby");
          }}
        />
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 pb-28">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">{isPublic ? "Public heat" : "Private heat"}</p>
              <h1 className="display text-6xl">{settings.title}</h1>
              <p className="text-sm text-muted">{net.joined ? "Pit is live." : "Linking the pit…"}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="display tabular-nums text-5xl tracking-widest text-gold">{code}</p>
              <Button
                type="button"
                variant="raised"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(code).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onLeave}>
                Leave
              </Button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2">
            <Seat
              title="Runner"
              who={labelFor(runnerId, seats)}
              mine={runnerId === net.selfId}
              taken={Boolean(runnerId && runnerId !== net.selfId)}
              onTake={() => claim(runnerId === net.selfId ? "none" : "runner")}
            />
            <Seat
              title="Scratcher"
              who={scratcherId ? labelFor(scratcherId, seats) : "Empty — CPU will scratch"}
              mine={scratcherId === net.selfId}
              taken={Boolean(scratcherId && scratcherId !== net.selfId)}
              onTake={() => claim(scratcherId === net.selfId ? "none" : "scratcher")}
            />
          </section>

          <section className="panel p-4">
            <p className="eyebrow">In the pit</p>
            <ul className="mt-2 flex flex-col gap-1">
              {seats.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="text-muted">{s.state === "you" ? "You" : s.state}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">{hosting ? "Host settings" : "Host's settings"}</p>
            </div>
            <SettingsForm value={settings} onChange={setSettings} locked={!hosting || phase !== "lobby"} />
          </section>

          {hosting && (
            <Button type="button" size="lg" disabled={!runnerId} onClick={start}>
              {scratcherId ? "Drop the flag" : "Drop the flag with CPU foil"}
            </Button>
          )}
          {!hosting && <p className="text-sm text-muted">Waiting on the host to drop the flag.</p>}
        </main>
      )}

      <ChatDock
        comms={settings.comms}
        messages={chat}
        onSend={sendChat}
        voiceOn={voiceOn}
        voiceError={voiceError}
        onToggleVoice={() => void toggleVoice()}
        streams={streams}
        placement={phase === "race" ? "top" : "bottom"}
      />
    </div>
  );
}

function labelFor(id: string | null, seats: { id: string; name: string }[]) {
  if (!id) return "Empty";
  return seats.find((s) => s.id === id)?.name ?? "Seat";
}

function Seat({
  title,
  who,
  mine,
  taken,
  onTake,
}: {
  title: string;
  who: string;
  mine: boolean;
  taken: boolean;
  onTake: () => void;
}) {
  return (
    <div className="ticket flex flex-col gap-3 p-4">
      <p className="eyebrow">{title}</p>
      <p className="display text-4xl">{who}</p>
      <Button type="button" variant={mine ? "ghost" : "gold"} disabled={taken} onClick={onTake}>
        {mine ? "Leave seat" : taken ? "Taken" : "Take this seat"}
      </Button>
    </div>
  );
}
