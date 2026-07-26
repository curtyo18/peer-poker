import { useEffect, useRef, useState } from 'react';
import type { DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import { AppHeader } from './ui/AppHeader';
import { Landing } from './ui/Landing';
import { JoinScreen } from './ui/JoinScreen';
import { RoomView } from './ui/RoomView';
import { useSession } from './store/session';
import type { Deck, SessionState } from './domain/types';
import { createHostPeer, connectToHost, isRoomMissingError, type HostPeer } from './net/peer';
import { attachHostLifecycle, type BrokerStatus, type HostLifecycle } from './net/hostLifecycle';
import { makeHostConn } from './net/hostConn';
import { makeGuestConn } from './net/guestConn';
import { setPeer, setHost, setGuest, getHost, teardownLive } from './net/live';
import { BrokerNotice } from './ui/BrokerNotice';
import { Button } from './ui/primitives';
import { rekeyHost } from './domain/rekey';
import {
  loadSession,
  saveSession,
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

type Mode = 'landing' | 'join' | 'host' | 'guest';
type Terminal = 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
// 'name-taken' is someone else holding the room name you asked for; 'resume-id-taken' is the
// broker still holding *your own* previous id, which is a different problem with different ways
// out. 'broker-unreachable' is the peer never opening at all.
type HostError = 'name-taken' | 'resume-id-taken' | 'broker-unreachable' | null;

const GUEST_CONNECT_TIMEOUT_MS = 15000;

function App() {
  const [mode, setMode] = useState<Mode>('landing');
  // Read on the first render, not in an effect: the entry decision below and the JoinScreen it
  // routes to both read this, so arriving a render late shows the landing page for a beat on
  // what is unambiguously an invite link.
  const [initialRoom, setInitialRoom] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get('room') ?? undefined,
  );
  const [shareLink, setShareLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | undefined>(undefined);
  const [terminal, setTerminal] = useState<Terminal>(null);
  const [resumable, setResumable] = useState<{ roomId: string; state: SessionState } | null>(null);
  const [resumableCode, setResumableCode] = useState<string | null>(null);
  const [hostError, setHostError] = useState<HostError>(null);
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus>('connecting');
  // A counter rather than a boolean: a second nudge has to be distinguishable from the first.
  const [nudgeSignal, setNudgeSignal] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [displayRoomCode, setDisplayRoomCode] = useState<string | undefined>(undefined);
  const [attemptedJoin, setAttemptedJoin] = useState<
    { roomCode: string; name: string; role: 'voter' | 'observer' } | null
  >(null);
  // Read once: localStorage is not a render-time source of truth. It tells the join screen what
  // this device remembered at startup, so a returning guest confirms a name instead of typing it.
  const [storedName] = useState(() => loadName());
  const state = useSession((s) => s.state);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinAttemptRef = useRef(0);
  const lifecycleRef = useRef<HostLifecycle | null>(null);
  // Whether the host peer has ever opened. A fatal error before that means the room never
  // started; the same error after means a running room lost its registration, which must not
  // tear down a session people are already playing in.
  const hostOpenedRef = useRef(false);

  useEffect(() => {
    const room = initialRoom;
    if (!room) return;
    let superseded = false;
    void (async () => {
      const entry = decideEntry({
        urlRoomId: await roomIdFromCode(room),
        savedSessionRoomId: loadSession()?.state.roomId ?? null,
      });
      if (superseded) return;
      // The link's code hashes to the saved session's room, so it is the readable name for a
      // room whose code we no longer store — leaving clears the code but keeps the session,
      // and a room id cannot be turned back into the code people type.
      if (entry === 'resume') setResumableCode((c) => c ?? room);
      if (entry === 'join') setMode('join');
    })();
    return () => { superseded = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setResumable(loadSession());
    setResumableCode(loadRoomCode());
  }, []);

  // A pending reconnect timer outlives the component otherwise.
  useEffect(() => () => lifecycleRef.current?.cancel(), []);

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

  const abandonHostPeer = () => {
    lifecycleRef.current?.cancel();
    lifecycleRef.current = null;
    teardownLive();
  };

  /**
   * Open a host peer with its full lifecycle wired up.
   *
   * Hosting and resuming differ only in what they do once the peer is open; the backoff, the
   * status reporting and the fatal-error handling are identical, and lived in two copies that
   * had already drifted — resume had neither an `error` nor a `disconnected` handler, so a peer
   * that failed to open left `ready` pending forever and the Resume button did nothing at all,
   * with no spinner and no error.
   */
  const openHostPeer = (
    { desiredId, label, onFatal }:
    { desiredId: string; label: string; onFatal: (kind: 'id-taken' | 'rejected') => void },
  ) => {
    lifecycleRef.current?.cancel();
    hostOpenedRef.current = false;
    setBrokerStatus('connecting');
    const hp = createHostPeer(desiredId);
    setPeer(hp.peer);
    lifecycleRef.current = attachHostLifecycle({
      peer: hp.peer,
      label,
      onStatus: setBrokerStatus,
      onFailure: (kind) => {
        if (!hostOpenedRef.current) {
          onFatal(kind);
          return;
        }
        // A room that has already opened has not stopped working for the people in it — their
        // data channels are direct. It has only stopped being reachable, so say that instead.
        setBrokerStatus('offline');
      },
    });
    void hp.ready.then(() => { hostOpenedRef.current = true; });
    return hp;
  };

  const handleHost = async (
    { deck, name, hostVotes, roomName }: { deck: Deck; name: string; hostVotes: boolean; roomName: string },
  ) => {
    setHostError(null);
    const code = roomName.trim() ? roomName.trim() : randomRoomCode();
    const id = await roomIdFromCode(code);
    saveRoomCode(code);
    setDisplayRoomCode(code);
    const hp = openHostPeer({
      desiredId: id,
      label: code,
      onFatal: (kind) => {
        setHostError(kind === 'id-taken' ? 'name-taken' : 'broker-unreachable');
        abandonHostPeer();
        setMode('landing');
      },
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

  // Everything that happens once a resumed peer is actually open. Both resume paths land here;
  // they differ only in which state and which room code they arrive with.
  const enterResumedRoom = (hp: HostPeer, state: SessionState, code: string) => {
    useSession.getState().resumeHost(state);
    const host = makeHostConn();
    setHost(host);
    hp.peer.on('connection', (conn) => conn.on('open', () => host.onConnection(conn)));
    saveRoomCode(code);
    setShareLink(buildLink(code));
    syncUrl(code);
    setDisplayRoomCode(code);
    setMyPeerId(state.hostPeerId);
    host.broadcast();
    setResuming(false);
    setResumable(null);
    setMode('host');
  };

  const handleResume = () => {
    const saved = loadSession();
    if (!saved) return;
    setHostError(null);
    setResuming(true);
    const hp = openHostPeer({
      desiredId: saved.state.roomId,
      label: saved.state.roomId,
      onFatal: (kind) => {
        setResuming(false);
        // The broker has not yet reaped the id this room used to hold. Waiting usually clears
        // it, so this offers the wait — it does not silently take a new id, which would change
        // the room id and kill the invite link people already have.
        setHostError(kind === 'id-taken' ? 'resume-id-taken' : 'broker-unreachable');
        abandonHostPeer();
      },
    });
    hp.ready.then(() => {
      // Fall back to the code from the link before the room id: an id is a one-way hash of a
      // code, so a link built from one would send joiners to a room that cannot exist.
      enterResumedRoom(hp, saved.state, loadRoomCode() ?? resumableCode ?? saved.state.roomId);
    });
  };

  // The way out when the old id stays taken: keep the agenda and the votes, take a new room
  // code, and accept that the previous link is dead. The copy on the button has to say so.
  const handleResumeFresh = async () => {
    const saved = loadSession();
    if (!saved) return;
    setHostError(null);
    setResuming(true);
    const code = randomRoomCode();
    const id = await roomIdFromCode(code);
    const state = rekeyHost(saved.state, id);
    const hp = openHostPeer({
      desiredId: id,
      label: code,
      onFatal: (kind) => {
        setResuming(false);
        setHostError(kind === 'id-taken' ? 'resume-id-taken' : 'broker-unreachable');
        abandonHostPeer();
      },
    });
    hp.ready.then(() => {
      saveSession(state.roomId, state);
      enterResumedRoom(hp, state, code);
    });
  };

  const handleDiscard = () => {
    clearSession();
    clearRoomCode();
    setHostError(null);
    setResumable(null);
    setResuming(false);
  };

  const handleJoin = async (
    { roomCode, name, role }: { roomCode: string; name: string; role: 'voter' | 'observer' },
  ) => {
    const id = await roomIdFromCode(roomCode);
    setDisplayRoomCode(roomCode);
    setAttemptedJoin({ roomCode, name, role });
    syncUrl(roomCode);
    const attempt = ++joinAttemptRef.current;
    const { peer, conn: pendingConn } = connectToHost(id);
    let conn: DataConnection | null = null;
    setPeer(peer);
    peer.on('open', (pid) => setMyPeerId(pid));
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
    setMode('guest');
    connectTimeoutRef.current = setTimeout(() => {
      // Nothing errored, the room just never answered — a different failure from a refused
      // or impossible connection, and it points at the host rather than at this device.
      if (useSession.getState().state === null) {
        const pc = conn?.peerConnection as RTCPeerConnection | undefined;
        console.error('[peerpoker] join timed out with no error', {
          roomCode,
          dialled: conn !== null,
          dataChannelOpen: conn?.open ?? false,
          ice: pc?.iceConnectionState,
          iceGathering: pc?.iceGatheringState,
          signaling: pc?.signalingState,
        });
        setTerminal('no-answer');
      }
    }, GUEST_CONNECT_TIMEOUT_MS);

    conn = await pendingConn;
    const guest = makeGuestConn(
      conn,
      (s) => setTerminal(s === 'kicked' ? 'kicked' : 'ended'),
      () => setNudgeSignal((n) => n + 1),
    );
    setGuest(guest);
    conn.on('open', () => guest.join(name, role));
  };

  // Offered when a join finds no host: take over the code they were trying to reach.
  const handleHostAttemptedRoom = () => {
    if (!attemptedJoin) return;
    const decks = loadDecks();
    const lastId = loadLastDeckId();
    const deck = decks.find((d) => d.id === lastId) ?? FIBONACCI;
    clearConnectTimeout();
    joinAttemptRef.current++;
    abandonHostPeer();
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

  // Backing out of an invite link is not leaving a room: nothing is live and nothing was joined.
  // In particular it must not clear the saved room code, which a resumable host session still
  // needs to rebuild a link people can actually reach.
  const handleAbandonJoin = () => {
    setInitialRoom(undefined);
    syncUrl(undefined);
    setMode('landing');
  };

  const handleLeave = () => {
    clearConnectTimeout();
    // A room only exists while its host has it open, so a host walking away has to say so before
    // the peer goes down. Without this, every guest keeps rendering a live-looking room forever:
    // guestConn only learns a session ended from an explicit message, never from a dropped
    // connection. This is the same call ResultsExport's "End session" makes.
    if (mode === 'host') getHost()?.end();
    abandonHostPeer();
    useSession.getState().reset();
    clearRoomCode();
    setHostError(null);
    setBrokerStatus('connecting');
    setResuming(false);
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

  // A host used to be hardcoded connected, so the header showed a green dot and the room code
  // with the broker gone entirely. It now tracks the real peer state.
  const connected =
    mode === 'host'
      ? brokerStatus === 'online'
      : mode === 'guest'
        ? state !== null && !terminal
        : undefined;
  const handleHome =
    mode === 'landing' ? undefined : mode === 'join' ? handleAbandonJoin : handleLeave;

  return (
    <>
      <AppHeader roomCode={displayRoomCode} connected={connected} onHome={handleHome} />
      {mode === 'host' && (
        <BrokerNotice status={brokerStatus} onRetry={() => lifecycleRef.current?.retry()} />
      )}
      {mode === 'landing' && (
        <>
          {hostError && (
            <div className="mx-auto mt-6 max-w-[1200px] px-4 sm:px-6">
              <div
                role="alert"
                className="rounded-2xl border border-alert-border bg-alert-bg px-5 py-4 text-sm text-alert-fg"
              >
                {hostError === 'name-taken' &&
                  'That room name is already in use right now — pick another.'}
                {hostError === 'broker-unreachable' &&
                  'Could not reach the signalling service, so the room never opened. Check your connection and try again.'}
                {hostError === 'resume-id-taken' && (
                  <>
                    Your previous room is still registered with the signalling service, so it
                    would not let us reclaim it. That usually clears within a minute or two.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="felt" size="sm" onClick={handleResume} disabled={resuming}>
                        Try again
                      </Button>
                      <Button
                        variant="felt"
                        size="sm"
                        onClick={handleResumeFresh}
                        disabled={resuming}
                      >
                        Resume on a new link
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-alert-fg/90">
                      A new link keeps the agenda and every vote, but changes the room code —
                      anyone holding the old link will need the new one.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          <Landing
            onHost={handleHost}
            onEnterCode={(code) => { setInitialRoom(code); setMode('join'); }}
            resume={
              resumable
                ? {
                    roomLabel: resumableCode ?? resumable.roomId,
                    pending: resuming,
                    onResume: handleResume,
                    onDiscard: handleDiscard,
                  }
                : undefined
            }
          />
        </>
      )}
      {mode === 'join' && initialRoom && (
        <JoinScreen roomCode={initialRoom} storedName={storedName} onJoin={handleJoin} />
      )}
      {mode === 'host' && state && myPeerId && (
        <RoomView
          role="host"
          state={state}
          shareLink={shareLink}
          roomCode={displayRoomCode}
          qrDataUrl={qrDataUrl}
          myPeerId={myPeerId}
          terminal={terminal}
          onLeave={handleLeave}
        />
      )}
      {mode === 'guest' && (
        <RoomView
          role="guest"
          state={state}
          shareLink={shareLink}
          roomCode={displayRoomCode}
          qrDataUrl={qrDataUrl}
          myPeerId={myPeerId}
          terminal={terminal}
          nudgeSignal={nudgeSignal}
          onHostRoom={attemptedJoin ? handleHostAttemptedRoom : undefined}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}

export default App;
