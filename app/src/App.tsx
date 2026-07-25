import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AppHeader } from './ui/AppHeader';
import { Landing } from './ui/Landing';
import { HostView } from './ui/HostView';
import { ParticipantView } from './ui/ParticipantView';
import { Button, panelClass } from './ui/primitives';
import { useSession } from './store/session';
import type { Deck, SessionState } from './domain/types';
import { createHostPeer, connectToHost } from './net/peer';
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
import { roomIdFromCode, randomRoomCode, normalizeRoomName } from './net/roomId';

type Mode = 'landing' | 'host' | 'guest';
type Terminal = 'kicked' | 'ended' | 'unreachable' | 'not-found' | null;

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
  const [attemptedJoin, setAttemptedJoin] = useState<{ roomCode: string; name: string } | null>(null);
  const state = useSession((s) => s.state);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoJoinedRef = useRef(false);

  useEffect(() => {
    const room = initialRoom;
    if (!room || autoJoinedRef.current) return;

    // A host reloading their own room lands on their own link — resume it rather than
    // trying to join the room they used to be hosting.
    const savedCode = loadRoomCode();
    const isOwnRoom =
      savedCode !== null &&
      normalizeRoomName(savedCode) === normalizeRoomName(room) &&
      loadSession() !== null;

    // With a name already on this device there is nothing left to ask: go straight in.
    // Without one, the landing page's join form collects it (see `needsName` below).
    const storedName = loadName();
    if (isOwnRoom || !storedName) return;
    autoJoinedRef.current = true;
    void handleJoin({ roomCode: room, name: storedName, role: 'voter' });
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
      if ((e as { type?: string }).type === 'unavailable-id') {
        setHostError('name-taken');
        teardownLive();
        setMode('landing');
      }
    });
    hp.ready.then((assignedId) => {
      useSession.getState().initHost(assignedId, deck, hostVotes);
      const host = makeHostConn();
      setHost(host);
      hp.peer.on('connection', (conn) => conn.on('open', () => host.onConnection(conn)));
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
      const code = loadRoomCode() ?? saved.state.roomId;
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
    setAttemptedJoin({ roomCode, name });
    syncUrl(roomCode);
    const { peer, conn } = connectToHost(id);
    setPeer(peer);
    peer.on('open', (pid) => setMyPeerId(pid));
    peer.on('error', (e) => {
      // 'peer-unavailable' means the broker has no such room — nobody is hosting it. Anything
      // else is a genuine connection failure, which is a different conversation with the user.
      const noSuchRoom = (e as { type?: string }).type === 'peer-unavailable';
      clearConnectTimeout();
      setTerminal(noSuchRoom ? 'not-found' : 'unreachable');
    });
    const guest = makeGuestConn(conn, (s) => setTerminal(s === 'kicked' ? 'kicked' : 'ended'));
    setGuest(guest);
    conn.on('open', () => guest.join(name, role));
    setMode('guest');
    connectTimeoutRef.current = setTimeout(() => {
      if (useSession.getState().state === null) setTerminal('unreachable');
    }, GUEST_CONNECT_TIMEOUT_MS);
  };

  // Offered when a join finds no host: take over the code they were trying to reach.
  const handleHostAttemptedRoom = () => {
    if (!attemptedJoin) return;
    const decks = loadDecks();
    const lastId = loadLastDeckId();
    const deck = decks.find((d) => d.id === lastId) ?? FIBONACCI;
    clearConnectTimeout();
    teardownLive();
    useSession.getState().reset();
    setTerminal(null);
    setMyPeerId(undefined);
    setAttemptedJoin(null);
    void handleHost({ deck, name: attemptedJoin.name, hostVotes: true, roomName: attemptedJoin.roomCode });
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
            needsName={!!initialRoom && loadName() === ''}
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
