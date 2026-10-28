import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MessageSquare, Lock } from "lucide-react";
import { textAllowed, voiceAllowed, type Comms } from "@/game/settings";
import { Button } from "@/components/ui/button";

export interface ChatLine {
  id: string;
  name: string;
  text: string;
}

export function ChatDock({
  comms,
  messages,
  onSend,
  voiceOn,
  voiceError,
  onToggleVoice,
  streams,
  placement,
}: {
  comms: Comms;
  messages: ChatLine[];
  onSend: (text: string) => void;
  voiceOn: boolean;
  voiceError: string | null;
  onToggleVoice: () => void;
  streams: { id: string; stream: MediaStream }[];
  placement: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const text = textAllowed(comms);
  const voice = voiceAllowed(comms);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const pos = placement === "top" ? "top-0" : "bottom-0";

  return (
    <div className={`pointer-events-none fixed inset-x-0 z-30 flex justify-end p-3 ${pos}`}>
      <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2">
        {open && text && (
          <div className="panel flex max-h-64 flex-col p-3">
            <div ref={scroller} className="flex max-h-40 flex-col gap-2 overflow-y-auto">
              {messages.length === 0 && <p className="text-sm text-muted">The line is quiet.</p>}
              {messages.map((m) => (
                <p key={m.id} className="text-sm">
                  <span className="font-semibold text-gold">{m.name}</span>{" "}
                  <span className="text-fg">{m.text}</span>
                </p>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const textValue = draft.trim();
                if (!textValue) return;
                onSend(textValue);
                setDraft("");
              }}
            >
              <input
                value={draft}
                maxLength={180}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say it short"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
              />
              <Button type="submit" size="sm" variant="gold">
                Send
              </Button>
            </form>
          </div>
        )}
        <div className="flex justify-end gap-2">
          {!text && !voice && (
            <span className="panel inline-flex h-11 items-center gap-2 px-3 text-sm text-muted">
              <Lock className="size-4" aria-hidden="true" />
              Line shut
            </span>
          )}
          {text && (
            <Button type="button" size="sm" variant="raised" onClick={() => setOpen((v) => !v)}>
              <MessageSquare className="size-4" aria-hidden="true" />
              Text
            </Button>
          )}
          {voice && (
            <Button type="button" size="sm" variant={voiceOn ? "gold" : "raised"} onClick={onToggleVoice}>
              {voiceOn ? <Mic className="size-4" aria-hidden="true" /> : <MicOff className="size-4" aria-hidden="true" />}
              {voiceOn ? "Mic live" : "Arm mic"}
            </Button>
          )}
        </div>
        {voiceError && <p className="text-right text-sm text-oxide">{voiceError}</p>}
      </div>
      {streams.map((s) => (
        <RemoteAudio key={s.id} stream={s.stream} />
      ))}
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}
