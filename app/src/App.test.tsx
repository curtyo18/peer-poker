import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionState } from './domain/types';
import { FIBONACCI } from './domain/decks';
import { roomIdFromCode } from './net/roomId';

type Handler = (arg?: unknown) => void;

/** Every Peer the app constructs during a test, newest last. */
const peers: FakePeer[] = [];

/** Every fake DataConnection `peer.connect()` has returned, newest last. */
const guestConns: Array<{ peerConnection: { signalingState: string } }> = [];

class FakePeer {
  id: string;
  open = false;
  disconnected = false;
  destroyed = false;
  reconnectCalls = 0;
  private handlers = new Map<string, Handler[]>();

  constructor(id?: string) {
    this.id = id ?? 'RANDOM-ID';
    peers.push(this);
  }
  on(ev: string, cb: Handler) {
    this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), cb]);
  }
  off(ev: string, cb: Handler) {
    this.handlers.set(ev, (this.handlers.get(ev) ?? []).filter((h) => h !== cb));
  }
  once(ev: string, cb: Handler) { this.on(ev, cb); }
  emit(ev: string, arg?: unknown) {
    for (const h of [...(this.handlers.get(ev) ?? [])]) h(arg);
  }
  connect() {
    const conn = {
      open: false,
      peerConnection: {
        signalingState: 'have-local-offer' as string,
        iceConnectionState: 'checking' as string,
        iceGatheringState: 'gathering' as string,
      },
      on: vi.fn(),
      send: vi.fn(),
    };
    guestConns.push(conn);
    return conn;
  }
  reconnect() { this.reconnectCalls += 1; }
  destroy() { this.destroyed = true; }
}

vi.mock('peerjs', () => ({ default: FakePeer }));
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,x') } }));

const ROOM_ID = 'pp-1234567890abcdef1234567890abcdef';

const savedState: SessionState = {
  roomId: ROOM_ID,
  hostPeerId: ROOM_ID,
  hostVotes: true,
  deck: FIBONACCI,
  participants: [{ peerId: ROOM_ID, name: 'Curt', role: 'voter', connected: true }],
  items: [{ id: 'i1', title: 'Login', status: 'voting', votes: {}, acceptedEstimate: null }],
  activeItemId: 'i1',
  revealed: false,
};

async function renderApp() {
  const { default: App } = await import('./App');
  return render(<App />);
}

const latestPeer = () => peers[peers.length - 1];

beforeEach(async () => {
  peers.length = 0;
  guestConns.length = 0;
  // A test that enters a room leaves ?room= on the jsdom URL, and the next App to mount reads it
  // as an invite link and routes to the join screen instead of the landing page.
  history.replaceState(null, '', '/');
  (await import('./store/session')).useSession.getState().reset();
  localStorage.clear();
  localStorage.setItem('poker.session', JSON.stringify({ roomId: ROOM_ID, state: savedState }));
  localStorage.setItem('poker.roomCode', 'FROG-42');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('App — resuming a host session', () => {
  it('offers the prior session', async () => {
    await renderApp();
    expect(await screen.findByText(/prior host session/i)).toBeInTheDocument();
  });

  // The bug this covers: handleResume attached no error and no disconnected handler, so a peer
  // that never opened left `ready` pending forever. Nothing changed on screen at all — no
  // spinner, no error — and the button looked dead because functionally it was.
  it('shows the resume is in flight before the peer has opened', async () => {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));

    expect(await screen.findByRole('button', { name: /resuming/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /discard/i })).toBeDisabled();
  });

  it('enters the room once the peer opens', async () => {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));

    latestPeer().emit('open', ROOM_ID);
    expect(await screen.findByText('Login')).toBeInTheDocument();
    expect(screen.queryByText(/prior host session/i)).not.toBeInTheDocument();
  });

  it('says so when the broker still holds the old id, instead of hanging', async () => {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));

    latestPeer().emit('error', { type: 'unavailable-id', message: 'ID is taken' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/still registered with the signalling service/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });

  it('offers a new link that keeps the agenda, and warns the old one dies', async () => {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));
    latestPeer().emit('error', { type: 'unavailable-id' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/anyone holding the old link will need the new one/i);

    await userEvent.click(screen.getByRole('button', { name: /resume on a new link/i }));
    await waitFor(() => expect(latestPeer().id).not.toBe(ROOM_ID));

    latestPeer().emit('open', latestPeer().id);
    expect(await screen.findByText('Login')).toBeInTheDocument();
    // The saved session now points at the new room, so a later reload resumes the right one.
    const saved = JSON.parse(localStorage.getItem('poker.session') as string);
    expect(saved.state.roomId).toBe(latestPeer().id);
    expect(saved.state.items[0].title).toBe('Login');
  });

  it('reports a peer that cannot reach the broker at all', async () => {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));

    latestPeer().emit('error', { type: 'ssl-unavailable' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the signalling service/i);
  });
});

// Bug: opening a host's own room link (?room=) landed on the full landing page with the resume
// banner buried in it, reading as blocked next to the join screen's focused "you're about to"
// confirmation an anonymous link gets. `resume` needs the same dedicated, one-click screen.
describe('App — following your own room link', () => {
  const OWN_CODE = 'OWN-ROOM';

  beforeEach(async () => {
    const ownRoomId = await roomIdFromCode(OWN_CODE);
    localStorage.setItem(
      'poker.session',
      JSON.stringify({ roomId: ownRoomId, state: { ...savedState, roomId: ownRoomId, hostPeerId: ownRoomId } }),
    );
    localStorage.setItem('poker.roomCode', OWN_CODE);
    history.replaceState(null, '', `/?room=${OWN_CODE}`);
  });

  it('offers a focused resume confirmation instead of the full landing page', async () => {
    await renderApp();

    expect(await screen.findByText(/you.re about to resume/i)).toBeInTheDocument();
    expect(screen.getByText(OWN_CODE)).toBeInTheDocument();
    expect(screen.queryByText(/start a session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prior host session/i)).not.toBeInTheDocument();
  });

  it('still resumes the room from the dedicated screen', async () => {
    await renderApp();
    await screen.findByText(/you.re about to resume/i);
    await userEvent.click(screen.getByRole('button', { name: /resume session/i }));

    latestPeer().emit('open', await roomIdFromCode(OWN_CODE));
    expect(await screen.findByText('Login')).toBeInTheDocument();
  });

  it('discarding backs out to the landing page', async () => {
    await renderApp();
    await screen.findByText(/you.re about to resume/i);
    await userEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(await screen.findByRole('heading', { name: /start a session/i })).toBeInTheDocument();
    expect(localStorage.getItem('poker.session')).toBeNull();
  });
});

describe('App — the host’s connection indicator', () => {
  async function enterHostedRoom() {
    await renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /resume session/i }));
    latestPeer().emit('open', ROOM_ID);
    await screen.findByText('Login');
    return latestPeer();
  }

  it('reads connected while the broker is there', async () => {
    await enterHostedRoom();
    expect(screen.getByText(/^Connected\.$/)).toBeInTheDocument();
  });

  // Previously hardcoded true: the broker could be gone entirely and the header still showed a
  // green dot and the room code, with the only evidence in the console.
  it('stops claiming connected when the broker drops the host', async () => {
    const peer = await enterHostedRoom();
    peer.disconnected = true;
    peer.emit('disconnected');

    expect(await screen.findByText(/^Not connected\.$/)).toBeInTheDocument();
  });

  it('tells the host new joiners are blocked while existing players are not', async () => {
    const peer = await enterHostedRoom();
    peer.disconnected = true;
    peer.emit('disconnected');

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(/reconnecting to the signalling service/i);
    expect(notice).toHaveTextContent(/everyone already in the room is unaffected/i);
    expect(notice).toHaveTextContent(/nobody new can join/i);
  });

  // A room already in progress must not be torn down because its registration lapsed — the
  // people in it are on direct data channels and are still playing.
  it('keeps an established room alive when the broker rejects its id', async () => {
    const peer = await enterHostedRoom();
    peer.emit('error', { type: 'unavailable-id' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/lost the connection to the signalling service/i);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});

describe('App — guest join timeout', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  async function startJoin(roomCode: string) {
    history.replaceState(null, '', `/?room=${roomCode}`);
    await renderApp();
    await vi.waitFor(() => expect(screen.getByText(roomCode)).toBeInTheDocument());
    await userEvent.setup({ delay: null }).type(
      screen.getByPlaceholderText(/your name/i),
      'Guest',
    );
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: /join/i }));
    await vi.waitFor(() => expect(latestPeer()).toBeDefined());
    latestPeer().emit('open', 'GUEST-PEER-ID');
    await vi.waitFor(() => expect(guestConns.length).toBeGreaterThan(0));
    return guestConns[guestConns.length - 1];
  }

  it('shows "room didn\'t answer" when no SDP answer ever arrives', async () => {
    await startJoin('NEWROOM1');
    const { GUEST_CONNECT_TIMEOUT_MS } = await import('./App');
    vi.advanceTimersByTime(GUEST_CONNECT_TIMEOUT_MS);
    expect(await screen.findByText(/room didn.t answer/i)).toBeInTheDocument();
  });

  it('shows "couldn\'t connect" when ICE hangs after an SDP answer arrives', async () => {
    const conn = await startJoin('NEWROOM2');
    conn.peerConnection.signalingState = 'stable';
    const { GUEST_CONNECT_TIMEOUT_MS } = await import('./App');
    vi.advanceTimersByTime(GUEST_CONNECT_TIMEOUT_MS);
    expect(await screen.findByText(/couldn.t connect/i)).toBeInTheDocument();
  });
});
