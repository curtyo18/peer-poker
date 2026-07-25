import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AppHeader } from './ui/AppHeader';
import { Landing } from './ui/Landing';
import { HostView } from './ui/HostView';
import { ParticipantView } from './ui/ParticipantView';
import { Button, panelClass } from './ui/primitives';
import { useSession } from './store/session';
import type { Deck, SessionState } from './domain/types';
import { createHostPeer, connectToHost, isRoomMissingError } from './net/peer';
import { makeHostConn } from './net/hostConn';
import { makeGuestConn } from './net/guestConn';
import { setPeer, setHost, setGuest, teardownLive } from './net/live';
import {
  loadSession,
  clearSession,
  loadRoomCode,
  saveRoomCode,
  clearRoomCode,
  loadName,
  loadDecks,
  loadLastDeckId,
} from './store/persistence';
import { FIBONACCI } from './domain/decks';
import { decideEntry } from './domain/entry';
import { roomIdFromCode, randomRoomCode } from './net/roomId';

type Mode = 'landing' | 'host' | 'guest';
type Terminal = 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;

const GUEST_CONNECT_TIMEOUT_MS = 15000;

function App() {
  const [mode, setMode] = useState<Mode>('landing');
  // Read on the first render, not in an effect: Landing seeds its room input from this once,
  // so arriving a render late leaves the field empty on a shared link.
  const [initialRoom, setInitialRoom] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get('room') ?? undefined,
  );
  const [shareLink, setShareLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | undefined>(undefined);
  const [terminal, setTerminal] = useState<Terminal>(null);
  const [resumable, setResumable] = useState<{ roomId: string; state: SessionState } | null>(null);
  const [resumableCode, setResumableCode] = useState<string | null>(null);
  const [hostError, setHostError] = useState<'name-taken' | null>(null);
  const [displayRoomCode, setDisplayRoomCode] = useState<string | undefined>(undefined);
  const [attemptedJoin, setAttemptedJoin] = useState<
    { roomCode: string; name: string; role: 'voter' | 'observer' } | null
  >(null);
  // Read once: localStorage is not a render-time source of truth, and the entry decision and
  // the landing page's name prompt must agree on what this device remembered at startup.
  const [storedName] = useState(() => loadName());
  const state = useSession((s) => s.state);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoJoinedRef = useRef(false);
  const joinAttemptRef = useRef(0);

  useEffect(() => {
    const room = initialRoom;
    if (!room || autoJoinedRef.current) return;
    let superseded = false;
    void (async () => {
      const entry = decideEntry({
        urlRoomId: await roomIdFromCode(room),
        savedSessionRoomId: loadSession()?.state.roomId ?? null,
        storedName,
      });
      if (superseded) return;
      // The link's code hashes to the saved session's room, so it is the readable name for a
      // room whose code we no longer store — leaving clears the code but keeps the session,
      // and a room id cannot be turned back into the code people type.
      if (entry === 'resume') setResumableCode((c) => c ?? room);
      if (autoJoinedRef.current || entry !== 'auto-join') return;
      autoJoinedRef.current = true;
      void handleJoin({ roomCode: room, name: storedName, role: 'voter' });
    })();
    return () => { superseded = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setResumable(loadSession());
    setResumableCode(loadRoomCode());
  }, []);

  useEffect(() => {
    if (!shareLink) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(shareLink)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [shareLink]);

  useEffect(() => {
    if (mode === 'guest' && state && connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, [mode, state]);

  const buildLink = (code: string) => {
    const base = import.meta.env.BASE_URL;
    return `${location.origin}${base}${base.endsWith('/') ? '' : '/'}?room=${encodeURIComponent(code)}`;
  };

  // Keep the address bar on the room's own link, so copying the URL shares the room the same
  // way the invite link does. replaceState, not pushState: Back should leave the app rather
  // than walk backwards through rooms.
  const syncUrl = (code: string | undefined) => {
    const base = import.meta.env.BASE_URL;
    history.replaceState(null, '', code ? buildLink(code) : `${location.origin}${base}`);
  };

  const clearConnectTimeout = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  };

  const handleHost = async (
    { deck, name, hostVotes, roomName }: { deck: Deck; name: string; hostVotes: boolean; roomName: string },
  ) => {
    setHostError(null);
    const code = roomName.trim() ? roomName.trim() : randomRoomCode();
    const id = await roomIdFromCode(code);
    saveRoomCode(code);
    setDisplayRoomCode(code);
    const hp = createHostPeer(id);
    setPeer(hp.peer);
    hp.peer.on('error', (e) => {
      const { type, message } = e as { type?: string; message?: string };
      console.error('[peerpoker] host peer error', { type, message, code });
      if (type === 'unavailable-id') {
        setHostError('name-taken');
        teardownLive();
        setMode('landing');
      }
    });
    // A peer that loses the broker keeps its open connections but stops being reachable, so
    // the room looks fine to the host while nobody new can join it.
    hp.peer.on('disconnected', () => {
      console.warn('[peerpoker] host lost the signalling broker — reconnecting');
      try { hp.peer.reconnect(); } catch { /* destroyed peer: nothing to reconnect */ }
    });
    hp.ready.then((assignedId) => {
      console.warn('[peerpoker] hosting', { code, requestedId: id, assignedId });
      useSession.getState().initHost(assignedId, deck, hostVotes);
      const host = makeHostConn();
      setHost(host);
      hp.peer.on('connection', (conn) => {
        console.warn('[peerpoker] incoming connection from', conn.peer);
        conn.on('open', () => {
          console.warn('[peerpoker] connection open', conn.peer);
          host.onConnection(conn);
        });
      });
      if (hostVotes) {
        useSession.getState().dispatch({ type: 'join', name, role: 'voter' }, assignedId);
        host.broadcast();
      }
      setShareLink(buildLink(code));
      syncUrl(code);
      setMyPeerId(assignedId);
      setMode('host');
    });
  };

  const handleResume = async () => {
    const saved = loadSession();
    if (!saved) return;
    setHostError(null);
    const hp = createHostPeer(saved.state.roomId);
    setPeer(hp.peer);
    hp.ready.then(() => {
      useSession.getState().resumeHost(saved.state);
      const host = makeHostConn();
      setHost(host);
      hp.peer.on('connection', (conn) => conn.on('open', () => host.onConnection(conn)));
      // Fall back to the code from the link before the room id: an id is a one-way hash of a
      // code, so a link built from one would send joiners to a room that cannot exist.
      const code = loadRoomCode() ?? resumableCode ?? saved.state.roomId;
      saveRoomCode(code);
      setShareLink(buildLink(code));
      syncUrl(code);
      setDisplayRoomCode(code);
      setMyPeerId(saved.state.hostPeerId);
      host.broadcast();
      setResumable(null);
      setMode('host');
    });
  };

  const handleDiscard = () => {
    clearSession();
    clearRoomCode();
    setHostError(null);
    setResumable(null);
  };

  const handleJoin = async (
    { roomCode, name, role }: { roomCode: string; name: string; role: 'voter' | 'observer' },
  ) => {
    const id = await roomIdFromCode(roomCode);
    setDisplayRoomCode(roomCode);
    setAttemptedJoin({ roomCode, name, role });
    syncUrl(roomCode);
    const attempt = ++joinAttemptRef.current;
    console.warn('[peerpoker] dialling', { code: roomCode, roomId: id });
    const { peer, conn } = connectToHost(id);
    setPeer(peer);
    // Until this fires the peer has no broker connection, and PeerJS quietly queues the offer
    // rather than failing — the join then dies of the timeout with nothing logged anywhere.
    peer.on('open', (pid) => {
      console.warn('[peerpoker] guest peer registered as', pid);
      setMyPeerId(pid);
    });
    peer.on('disconnected', () => console.warn('[peerpoker] guest lost the broker'));
    peer.on('error', (e) => {
      // A torn-down peer can still emit; ignore anything from an attempt we have moved on from.
      if (attempt !== joinAttemptRef.current) return;
      const { type, message } = e as { type?: string; message?: string };
      // The type is the only thing that says *why* a join failed; without it every failure
      // looks alike and is undiagnosable from a bug report.
      console.error('[peerpoker] join failed', { type, message, roomCode });
      clearConnectTimeout();
      setTerminal(isRoomMissingError(e) ? 'not-found' : 'unreachable');
    });
    // Whether ICE ever completes is the difference between "the host never replied" and
    // "the two browsers could not find a path to each other".
    conn.on('iceStateChanged', (s) => console.warn('[peerpoker] ice', s));
    const guest = makeGuestConn(conn, (s) => setTerminal(s === 'kicked' ? 'kicked' : 'ended'));
    setGuest(guest);
    conn.on('open', () => guest.join(name, role));
    setMode('guest');
    connectTimeoutRef.current = setTimeout(() => {
      // Nothing errored, the room just never answered — a different failure from a refused
      // or impossible connection, and it points at the host rather than at this device.
      if (useSession.getState().state === null) {
        const pc = conn.peerConnection as RTCPeerConnection | undefined;
        console.error('[peerpoker] join timed out with no error', {
          roomCode,
          dataChannelOpen: conn.open,
          ice: pc?.iceConnectionState,
          iceGathering: pc?.iceGatheringState,
          signaling: pc?.signalingState,
        });
        void pc?.getStats().then((stats) => {
          const pairs: unknown[] = [];
          stats.forEach((r) => {
            if (r.type === 'candidate-pair' || r.type === 'local-candidate') {
              pairs.push({ type: r.type, state: r.state, candidate: r.candidateType, addr: r.address });
            }
          });
          console.error('[peerpoker] ice candidates', pairs);
        });
        setTerminal('no-answer');
      }
    }, GUEST_CONNECT_TIMEOUT_MS);
  };

  // Offered when a join finds no host: take over the code they were trying to reach.
  const handleHostAttemptedRoom = () => {
    if (!attemptedJoin) return;
    const decks = loadDecks();
    const lastId = loadLastDeckId();
    const deck = decks.find((d) => d.id === lastId) ?? FIBONACCI;
    clearConnectTimeout();
    joinAttemptRef.current++;
    teardownLive();
    useSession.getState().reset();
    setTerminal(null);
    setMyPeerId(undefined);
    setAttemptedJoin(null);
    // Someone who came to watch stays a watcher when they end up running the room.
    void handleHost({
      deck,
      name: attemptedJoin.name,
      hostVotes: attemptedJoin.role === 'voter',
      roomName: attemptedJoin.roomCode,
    });
  };

  const handleLeave = () => {
    clearConnectTimeout();
    teardownLive();
    useSession.getState().reset();
    clearRoomCode();
    setHostError(null);
    setShareLink('');
    setQrDataUrl(null);
    setMyPeerId(undefined);
    setTerminal(null);
    setDisplayRoomCode(undefined);
    setAttemptedJoin(null);
    setInitialRoom(undefined);
    syncUrl(undefined);
    setMode('landing');
  };

  const connected = mode === 'host' ? true : mode === 'guest' ? state !== null && !terminal : undefined;

  return (
    <>
      <AppHeader roomCode={displayRoomCode} connected={connected} onHome={mode !== 'landing' ? handleLeave : undefined} />
      {mode === 'landing' && (
        <>
          {resumable && (
            <div className="mx-auto mt-6 max-w-[1200px] px-4 sm:px-6">
              <div className={`flex flex-wrap items-center justify-between gap-4 ${panelClass}`}>
                <span className="text-sm text-fg">
                  You have a prior host session for room &ldquo;{resumableCode ?? resumable.roomId}&rdquo;.
                </span>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleResume}>
                    Resume session
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDiscard}>
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          )}
          {hostError === 'name-taken' && (
            <div className="mx-auto mt-6 max-w-[1200px] px-4 sm:px-6">
              <div
                role="alert"
                className="rounded-2xl border border-alert-border bg-alert-bg px-5 py-4 text-sm text-alert-fg"
              >
                That room name is already in use right now — pick another.
              </div>
            </div>
          )}
          <Landing
            initialRoom={initialRoom}
            needsName={!!initialRoom && storedName.trim() === ''}
            onHost={handleHost}
            onJoin={handleJoin}
          />
        </>
      )}
      {mode === 'host' && state && myPeerId && (
        <HostView
          state={state}
          shareLink={shareLink}
          roomCode={displayRoomCode}
          qrDataUrl={qrDataUrl}
          myPeerId={myPeerId}
          onLeave={handleLeave}
        />
      )}
      {mode === 'guest' && (
        <ParticipantView
          state={state}
          myPeerId={myPeerId}
          terminal={terminal}
          roomCode={displayRoomCode}
          onHostRoom={attemptedJoin ? handleHostAttemptedRoom : undefined}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}

export default App;
