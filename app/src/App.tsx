import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AppHeader } from './ui/AppHeader';
import { Landing } from './ui/Landing';
import { useSession } from './store/session';
import type { Deck } from './domain/types';
import { createHostPeer, connectToHost } from './net/peer';
import { makeHostConn } from './net/hostConn';
import { makeGuestConn } from './net/guestConn';
import { setPeer, setHost, setGuest, teardownLive } from './net/live';

type Mode = 'landing' | 'host' | 'guest';

const mainClass = 'mx-auto flex max-w-2xl flex-col gap-4 p-4';
const buttonClass =
  'rounded border border-border bg-muted px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';

function App() {
  const [mode, setMode] = useState<Mode>('landing');
  const [initialRoom, setInitialRoom] = useState<string | undefined>(undefined);
  const [shareLink, setShareLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const state = useSession((s) => s.state);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) setInitialRoom(room);
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

  const handleHost = async ({ deck, name, hostVotes }: { deck: Deck; name: string; hostVotes: boolean }) => {
    const hp = createHostPeer();
    setPeer(hp.peer);
    const id = await hp.ready;
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

  const handleJoin = ({ roomId, name, role }: { roomId: string; name: string; role: 'voter' | 'observer' }) => {
    const { peer, conn } = connectToHost(roomId);
    setPeer(peer);
    const guest = makeGuestConn(conn);
    setGuest(guest);
    conn.on('open', () => guest.join(name, role));
    setMode('guest');
  };

  const handleLeave = () => {
    teardownLive();
    useSession.getState().reset();
    setShareLink('');
    setQrDataUrl(null);
    setMode('landing');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => { /* ignore */ });
  };

  return (
    <>
      <AppHeader />
      {mode === 'landing' && (
        <Landing initialRoom={initialRoom} onHost={handleHost} onJoin={handleJoin} />
      )}
      {mode === 'host' && (
        <main className={mainClass}>
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Waiting for participants&hellip;</h2>
            <p className="break-all text-sm text-fg">{shareLink}</p>
            <div className="flex items-center gap-3">
              <button type="button" className={buttonClass} onClick={handleCopyLink}>
                Copy link
              </button>
              <button type="button" className={buttonClass} onClick={handleLeave}>
                Leave
              </button>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code for room link" width={180} height={180} />}
          </section>
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Participants</h2>
            <ul className="space-y-1">
              {state?.participants.map((p) => (
                <li key={p.peerId} className="text-sm text-fg">
                  {p.name} &middot; {p.role} &middot; {p.connected ? 'connected' : 'disconnected'}
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}
      {mode === 'guest' && (
        <main className={mainClass}>
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">
              {state ? `Room ${state.roomId}` : 'Connecting…'}
            </h2>
            <button type="button" className={buttonClass} onClick={handleLeave}>
              Leave
            </button>
          </section>
          {state && (
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold">Participants</h2>
              <ul className="space-y-1">
                {state.participants.map((p) => (
                  <li key={p.peerId} className="text-sm text-fg">
                    {p.name} &middot; {p.role} &middot; {p.connected ? 'connected' : 'disconnected'}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}
    </>
  );
}

export default App;
