import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AppHeader } from './ui/AppHeader';
import { Landing } from './ui/Landing';
import { HostView } from './ui/HostView';
import { ParticipantView } from './ui/ParticipantView';
import { useSession } from './store/session';
import type { Deck, SessionState } from './domain/types';
import { createHostPeer, connectToHost } from './net/peer';
import { makeHostConn } from './net/hostConn';
import { makeGuestConn } from './net/guestConn';
import { setPeer, setHost, setGuest, teardownLive } from './net/live';
import { loadSession, clearSession, loadRoomCode, saveRoomCode, clearRoomCode } from './store/persistence';
import { roomIdFromCode, randomRoomCode } from './net/roomId';

type Mode = 'landing' | 'host' | 'guest';
type Terminal = 'kicked' | 'ended' | 'unreachable' | null;

const GUEST_CONNECT_TIMEOUT_MS = 15000;

function App() {
  const [mode, setMode] = useState<Mode>('landing');
  const [initialRoom, setInitialRoom] = useState<string | undefined>(undefined);
  const [shareLink, setShareLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | undefined>(undefined);
  const [terminal, setTerminal] = useState<Terminal>(null);
  const [resumable, setResumable] = useState<{ roomId: string; state: SessionState } | null>(null);
  const [resumableCode, setResumableCode] = useState<string | null>(null);
  const [hostError, setHostError] = useState<'name-taken' | null>(null);
  const [displayRoomCode, setDisplayRoomCode] = useState<string | undefined>(undefined);
  const state = useSession((s) => s.state);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) setInitialRoom(room);
  }, []);

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
    const { peer, conn } = connectToHost(id);
    setPeer(peer);
    peer.on('open', (pid) => setMyPeerId(pid));
    peer.on('error', () => setTerminal('unreachable'));
    const guest = makeGuestConn(conn, (s) => setTerminal(s === 'kicked' ? 'kicked' : 'ended'));
    setGuest(guest);
    conn.on('open', () => guest.join(name, role));
    setMode('guest');
    connectTimeoutRef.current = setTimeout(() => {
      if (useSession.getState().state === null) setTerminal('unreachable');
    }, GUEST_CONNECT_TIMEOUT_MS);
  };

  const handleLeave = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    teardownLive();
    useSession.getState().reset();
    clearRoomCode();
    setHostError(null);
    setShareLink('');
    setQrDataUrl(null);
    setMyPeerId(undefined);
    setTerminal(null);
    setDisplayRoomCode(undefined);
    setMode('landing');
  };

  const connected = mode === 'host' ? true : mode === 'guest' ? state !== null && !terminal : undefined;

  return (
    <>
      <AppHeader roomCode={displayRoomCode} connected={connected} onHome={mode !== 'landing' ? handleLeave : undefined} />
      {mode === 'landing' && (
        <>
          {resumable && (
            <div className="mx-auto mt-4 flex max-w-2xl items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4 text-fg">
              <span>You have a prior host session for room &ldquo;{resumableCode ?? resumable.roomId}&rdquo;.</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors"
                  onClick={handleResume}
                >
                  Resume session
                </button>
                <button
                  type="button"
                  className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors"
                  onClick={handleDiscard}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          {hostError === 'name-taken' && (
            <div
              role="alert"
              className="mx-auto mt-4 max-w-2xl rounded-lg border border-border bg-muted p-4 text-fg"
            >
              That room name is already in use right now — pick another.
            </div>
          )}
          <Landing initialRoom={initialRoom} onHost={handleHost} onJoin={handleJoin} />
        </>
      )}
      {mode === 'host' && state && myPeerId && (
        <HostView
          state={state}
          shareLink={shareLink}
          qrDataUrl={qrDataUrl}
          myPeerId={myPeerId}
          onLeave={handleLeave}
        />
      )}
      {mode === 'guest' && (
        <ParticipantView state={state} myPeerId={myPeerId} terminal={terminal} onLeave={handleLeave} />
      )}
    </>
  );
}

export default App;
