import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api-client';

export interface VoicePeer {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
  /** Rough 0-1 loudness, used to light up the speaking ring. */
  level?: number;
}

type Status = 'idle' | 'connecting' | 'connected' | 'error';

// Public STUN only. Peers behind symmetric NAT will fail to connect without
// a TURN relay — see the note in the voice UI.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * Peer-to-peer voice for one board, meshed over the existing socket.io
 * signalling server. Every participant holds one RTCPeerConnection per other
 * participant, so this is comfortable up to roughly five people.
 */
export function useVoiceRoom(boardId: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [muted, setMuted] = useState(false);
  const [selfLevel, setSelfLevel] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const analyserRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const teardown = useCallback(() => {
    connectionsRef.current.forEach((pc) => pc.close());
    connectionsRef.current.clear();

    audioElsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElsRef.current.clear();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (analyserRef.current) {
      cancelAnimationFrame(analyserRef.current.raf);
      void analyserRef.current.ctx.close();
      analyserRef.current = null;
    }

    socketRef.current?.disconnect();
    socketRef.current = null;

    setPeers([]);
    setSelfLevel(0);
    setStatus('idle');
  }, []);

  /** Attaches a remote track to a hidden <audio> element so it actually plays. */
  const playRemote = useCallback((socketId: string, stream: MediaStream) => {
    let el = audioElsRef.current.get(socketId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElsRef.current.set(socketId, el);
    }
    el.srcObject = stream;
    void el.play().catch(() => {
      /* autoplay policy — the user gesture that joined the call covers this */
    });
  }, []);

  const createConnection = useCallback(
    (socket: Socket, peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      connectionsRef.current.set(peerId, pc);

      streamRef.current
        ?.getTracks()
        .forEach((track) => pc.addTrack(track, streamRef.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('signal', { to: peerId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => playRemote(peerId, e.streams[0]);

      return pc;
    },
    [playRemote],
  );

  const join = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;
    setStatus('connecting');
    setError(null);

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError('Microphone permission denied.');
      setStatus('error');
      return;
    }

    // Local level meter for the speaking indicator.
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(streamRef.current).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setSelfLevel(peak);
        analyserRef.current = { ctx, raf: requestAnimationFrame(tick) };
      };
      analyserRef.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {
      /* level meter is cosmetic — carry on without it */
    }

    const socket = io(`${API_BASE_URL}/voice`, { withCredentials: true });
    socketRef.current = socket;

    socket.on('signal', async ({ from, data }: { from: string; data: any }) => {
      let pc = connectionsRef.current.get(from);
      if (!pc) pc = createConnection(socket, from);

      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          /* candidates can arrive before the remote description; safe to drop */
        }
      }
    });

    socket.on('peer-joined', (peer: VoicePeer) => {
      // The existing member waits to be called: the newcomer initiates.
      setPeers((prev) => [...prev.filter((p) => p.socketId !== peer.socketId), peer]);
    });

    socket.on('peer-left', ({ socketId }: { socketId: string }) => {
      connectionsRef.current.get(socketId)?.close();
      connectionsRef.current.delete(socketId);
      audioElsRef.current.get(socketId)?.remove();
      audioElsRef.current.delete(socketId);
      setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on('peer-muted', ({ socketId, muted: m }: { socketId: string; muted: boolean }) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, muted: m } : p)),
      );
    });

    socket.emit(
      'join',
      { boardId },
      async (res: { error?: string; peers?: VoicePeer[] }) => {
        if (res?.error) {
          setError(res.error);
          setStatus('error');
          teardown();
          return;
        }
        setPeers(res.peers ?? []);
        setStatus('connected');

        // We are the newcomer, so we call everyone already here.
        for (const peer of res.peers ?? []) {
          const pc = createConnection(socket, peer.socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', {
            to: peer.socketId,
            data: { sdp: pc.localDescription },
          });
        }
      },
    );
  }, [boardId, status, createConnection, teardown]);

  const leave = useCallback(() => {
    socketRef.current?.emit('leave');
    teardown();
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    socketRef.current?.emit('mute', { muted: next });
  }, [muted]);

  useEffect(() => teardown, [teardown]);

  return { status, error, peers, muted, selfLevel, join, leave, toggleMute };
}
