import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api-client';

export type PeerConnectionState = 'connecting' | 'connected' | 'failed';

export interface VoicePeer {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
  connection?: PeerConnectionState;
}

type Status = 'idle' | 'connecting' | 'connected' | 'error';

type Signal =
  | { sdp: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit };

const SPEAKING_THRESHOLD = 0.08;

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turn = import.meta.env.VITE_TURN_URLS as string | undefined;
  if (turn) {
    servers.push({
      urls: turn.split(',').map((url) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
}

export function useVoiceRoom(boardId: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const statusRef = useRef<Status>('idle');
  const mutedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef(new Map<string, RTCPeerConnection>());

  const offeredToRef = useRef(new Set<string>());
  const signalQueuesRef = useRef(new Map<string, Promise<void>>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const analyserRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  const updateStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const setPeerConnection = useCallback(
    (socketId: string, connection: PeerConnectionState) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, connection } : p)),
      );
    },
    [],
  );

  const closePeer = useCallback((socketId: string) => {
    connectionsRef.current.get(socketId)?.close();
    connectionsRef.current.delete(socketId);
    offeredToRef.current.delete(socketId);
    signalQueuesRef.current.delete(socketId);
    pendingCandidatesRef.current.delete(socketId);
    const el = audioElsRef.current.get(socketId);
    if (el) {
      el.srcObject = null;
      el.remove();
    }
    audioElsRef.current.delete(socketId);
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const socketId of [...connectionsRef.current.keys()]) closePeer(socketId);
    setPeers([]);
  }, [closePeer]);

  const teardown = useCallback(() => {
    closeAllPeers();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (analyserRef.current) {
      cancelAnimationFrame(analyserRef.current.raf);
      void analyserRef.current.ctx.close();
      analyserRef.current = null;
    }

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;

    mutedRef.current = false;
    setMuted(false);
    setSpeaking(false);
    updateStatus('idle');
  }, [closeAllPeers, updateStatus]);

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
    void el.play().catch(() => {});
  }, []);

  const sendOffer = useCallback(
    async (socket: Socket, peerId: string, pc: RTCPeerConnection, iceRestart = false) => {
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: peerId, data: { sdp: pc.localDescription } });
    },
    [],
  );

  const createConnection = useCallback(
    (socket: Socket, peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      connectionsRef.current.set(peerId, pc);

      const stream = streamRef.current;
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('signal', { to: peerId, data: { candidate: e.candidate.toJSON() } });
        }
      };
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        playRemote(peerId, remote ?? new MediaStream([e.track]));
      };
      pc.onconnectionstatechange = () => {
        if (connectionsRef.current.get(peerId) !== pc) return;
        if (pc.connectionState === 'connected') {
          setPeerConnection(peerId, 'connected');
        } else if (pc.connectionState === 'failed') {
          setPeerConnection(peerId, 'failed');
          if (offeredToRef.current.has(peerId)) {
            void sendOffer(socket, peerId, pc, true).catch(() => {});
          }
        }
      };

      return pc;
    },
    [playRemote, sendOffer, setPeerConnection],
  );

  const handleSignal = useCallback(
    async (socket: Socket, from: string, data: Signal) => {
      let pc = connectionsRef.current.get(from);
      if (!pc) pc = createConnection(socket, from);

      if ('sdp' in data) {
        await pc.setRemoteDescription(data.sdp);
        for (const candidate of pendingCandidatesRef.current.get(from) ?? []) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        pendingCandidatesRef.current.delete(from);
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer());
          socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
        }
      } else if ('candidate' in data) {
        if (!pc.remoteDescription) {
          const pending = pendingCandidatesRef.current.get(from) ?? [];
          pending.push(data.candidate);
          pendingCandidatesRef.current.set(from, pending);
        } else {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        }
      }
    },
    [createConnection],
  );

  const join = useCallback(async () => {
    if (statusRef.current === 'connecting' || statusRef.current === 'connected') return;
    updateStatus('connecting');
    setError(null);

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const denied = e instanceof DOMException && e.name === 'NotAllowedError';
      setError(denied ? 'Microphone permission denied.' : 'No microphone available.');
      updateStatus('error');
      return;
    }

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
        setSpeaking(!mutedRef.current && peak > SPEAKING_THRESHOLD);
        analyserRef.current = { ctx, raf: requestAnimationFrame(tick) };
      };
      analyserRef.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {

    }

    const socket = io(`${API_BASE_URL}/voice`, { withCredentials: true });
    socketRef.current = socket;
    let everConnected = false;

    const enterRoom = () => {
      socket.emit(
        'join',
        { boardId },
        async (res: { error?: string; peers?: VoicePeer[] }) => {
          if (res?.error) {
            teardown();
            setError(res.error);
            updateStatus('error');
            return;
          }
          const existing = (res.peers ?? []).map((p) => ({
            ...p,
            connection: 'connecting' as const,
          }));
          setPeers(existing);
          updateStatus('connected');
          if (mutedRef.current) socket.emit('mute', { muted: true });

          for (const peer of existing) {
            const pc = createConnection(socket, peer.socketId);
            offeredToRef.current.add(peer.socketId);
            await sendOffer(socket, peer.socketId, pc).catch(() => {});
          }
        },
      );
    };

    socket.on('connect', () => {
      everConnected = true;
      enterRoom();
    });

    socket.on('disconnect', () => {
      if (socketRef.current !== socket) return;
      closeAllPeers();
      updateStatus('connecting');
    });

    socket.on('connect_error', () => {
      if (everConnected) return;
      teardown();
      setError('Could not reach the voice server.');
      updateStatus('error');
    });

    socket.on('signal', ({ from, data }: { from: string; data: Signal }) => {
      const queue = signalQueuesRef.current.get(from) ?? Promise.resolve();
      const next = queue
        .then(() => handleSignal(socket, from, data))
        .catch((e) => console.warn('voice signal failed', e));
      signalQueuesRef.current.set(from, next);
    });

    socket.on('peer-joined', (peer: VoicePeer) => {
      closePeer(peer.socketId);
      setPeers((prev) => [
        ...prev.filter((p) => p.socketId !== peer.socketId),
        { ...peer, connection: 'connecting' },
      ]);
    });

    socket.on('peer-left', ({ socketId }: { socketId: string }) => {
      closePeer(socketId);
      setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on('peer-muted', ({ socketId, muted: m }: { socketId: string; muted: boolean }) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, muted: m } : p)),
      );
    });
  }, [
    boardId,
    closeAllPeers,
    closePeer,
    createConnection,
    handleSignal,
    sendOffer,
    teardown,
    updateStatus,
  ]);

  const leave = useCallback(() => {
    socketRef.current?.emit('leave');
    teardown();
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    socketRef.current?.emit('mute', { muted: next });
  }, []);

  useEffect(() => teardown, [teardown]);

  return { status, error, peers, muted, speaking, join, leave, toggleMute };
}
