import { useCallback, useEffect, useRef, useState } from "react";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";

type Listener = (from: string, data: unknown, channel: "state" | "reliable") => void;

export function useFoilNet(room: string, name: string, preferredId?: string) {
  const [selfId] = useState(
    () => preferredId && /^[a-zA-Z0-9_-]{1,64}$/.test(preferredId)
      ? preferredId
      : `p-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [joined, setJoined] = useState(false);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const roomRef = useRef<P2PRoom | null>(null);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const p2p = new P2PRoom({
      room,
      selfId,
      name,
      onPeersChanged: (list) => {
        setPeers(list);
        setStreams((prev) => {
          const next: Record<string, MediaStream> = {};
          let changed = false;
          for (const peer of list) {
            const stream = prev[peer.id];
            if (stream) next[peer.id] = stream;
          }
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(next);
          if (prevKeys.length !== nextKeys.length) changed = true;
          if (!changed) return prev;
          return next;
        });
      },
      onMessage: (from, data, channel) => {
        for (const fn of listeners.current) fn(from, data, channel);
      },
      onConnected: () => setJoined(true),
      onRemoteTrack: (id, stream) => {
        setStreams((prev) => ({ ...prev, [id]: stream }));
      },
    });
    roomRef.current = p2p;
    void p2p.join();
    return () => {
      roomRef.current = null;
      p2p.close();
    };
  }, [room, selfId, name]);

  const broadcast = useCallback((data: unknown) => roomRef.current?.broadcast(data), []);
  const send = useCallback((data: unknown, peerId?: string) => roomRef.current?.send(data, peerId), []);
  const onMessage = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  const setLocalVoice = useCallback((stream: MediaStream | null) => {
    roomRef.current?.setLocalVoice(stream);
  }, []);

  return { selfId, room, peers, joined, streams, broadcast, send, onMessage, setLocalVoice };
}

export type FoilNet = ReturnType<typeof useFoilNet>;
