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
import { loadSession, clearSession } from './store/persistence';

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
  const state = useSession((s) => s.state);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) setInitialRoom(room);
  }, []);

  useEffect(() => {
    setResumable(loadSession());
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

  const handleHost = async ({ deck, name, hostVotes }: { deck: Deck; name: string; hostVotes: boolean }) => {
    const hp = createHostPeer();
    setPeer(hp.peer);
    const id = await hp.ready;
    setMyPeerId(id);
    useSession.getState().initHost(id, deck, hostVotes);
    const host = makeHostConn();
    setHost(host);
    hp.peer.on('connection', (conn) => conn.on('open', () => host.onConnection(conn)));
    if (hostVotes) {
      useSession.getState().dispatch({ type: 'join', name, role: 'voter' }, id);
      host.broadcast();
    }
    const base = import.meta.env.BASE_URL;
    const link = `${location.origin}${base}${base.endsWith('/') ? '' : '/'}?room=${id}`;
    setShareLink(link);
    setMode('host');
  };

  const handleResume = async () => {
    const saved = loadSession();
    if (!saved) return;
    const hp = createHostPeer();
    setPeer(hp.peer);
    await hp.ready;
    useSession.getState().resumeHost(saved.state);
    const host = makeHostConn();
    setHost(host);
    hp.peer.on('connection', (conn) => conn.on('open', () => host.onConnection(conn)));
    const base = import.meta.env.BASE_URL;
    const link = `${location.origin}${base}${base.endsWith('/') ? '' : '/'}?room=${saved.state.roomId}`;
    setShareLink(link);
    setMyPeerId(saved.state.hostPeerId);
    host.broadcast();
    setResumable(null);
    setMode('host');
  };

  const handleDiscard = () => {
    clearSession();
    setResumable(null);
  };

  const handleJoin = ({ roomId, name, role }: { roomId: string; name: string; role: 'voter' | 'observer' }) => {
    const { peer, conn } = connectToHost(roomId);
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
    setShareLink('');
    setQrDataUrl(null);
    setMyPeerId(undefined);
    setTerminal(null);
    setMode('landing');
  };

  return (
    <>
      <AppHeader />
      {mode === 'landing' && (
        <>
          {resumable && (
            <div className="mx-auto mt-4 flex max-w-2xl items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4 text-fg">
              <span>You have a prior host session for room &ldquo;{resumable.roomId}&rdquo;.</span>
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
