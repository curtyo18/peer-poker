import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AgendaItem, SessionState } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { RoomView } from './RoomView';

// RoomView is the one piece of this redesign that decides *which* screen you are on. Every stage
// is tested in isolation; this covers the choice between them, which nothing else does.

vi.mock('../net/live', () => ({
  getHost: () => null,
  getGuest: () => null,
}));

function stateWith(overrides: Partial<SessionState> = {}): SessionState {
  const item: AgendaItem = {
    id: 'i1',
    title: 'Checkout spike',
    status: 'voting',
    votes: {},
    acceptedEstimate: null,
  };
  return {
    roomId: 'FROG-42',
    hostPeerId: 'host',
    hostVotes: true,
    deck: FIBONACCI,
    participants: [{ peerId: 'p1', name: 'Ana', role: 'voter', connected: true }],
    items: [item],
    activeItemId: null,
    revealed: false,
    ...overrides,
  };
}

const props = (overrides: Partial<Parameters<typeof RoomView>[0]> = {}) => ({
  role: 'host' as const,
  state: stateWith(),
  shareLink: 'https://example.test/?room=FROG-42',
  roomCode: 'FROG-42',
  qrDataUrl: null,
  myPeerId: 'p1',
  terminal: null,
  onLeave: vi.fn(),
  ...overrides,
});

describe('RoomView', () => {
  afterEach(() => localStorage.clear());

  it('shows the console when no item is active', () => {
    render(<RoomView {...props()} />);
    expect(screen.getByText(/your table is live/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal all/i })).not.toBeInTheDocument();
  });

  it('shows the voting stage for an active item that is not revealed', () => {
    render(<RoomView {...props({ state: stateWith({ activeItemId: 'i1' }) })} />);
    expect(screen.getByRole('button', { name: /reveal all/i })).toBeInTheDocument();
    expect(screen.queryByText(/the reveal/i)).not.toBeInTheDocument();
  });

  it('shows the reveal once the host has revealed', () => {
    const revealed = stateWith({
      activeItemId: 'i1',
      revealed: true,
      items: [{ ...stateWith().items[0], status: 'revealed', votes: { p1: '5' } }],
    });
    render(<RoomView {...props({ state: revealed })} />);
    expect(screen.getByText(/the reveal/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal all/i })).not.toBeInTheDocument();
  });

  // An activeItemId pointing at nothing must not strand the room on a blank stage.
  it('falls back to the console when the active item id matches no item', () => {
    render(<RoomView {...props({ state: stateWith({ activeItemId: 'gone' }) })} />);
    expect(screen.getByText(/your table is live/i)).toBeInTheDocument();
  });

  it('shows a guest the connecting state before any state arrives', () => {
    render(<RoomView {...props({ role: 'guest', state: null })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/connecting/i);
  });

  it('offers to host the room when nobody is hosting the code', () => {
    const onHostRoom = vi.fn();
    render(
      <RoomView {...props({ role: 'guest', state: null, terminal: 'not-found', onHostRoom })} />,
    );
    expect(screen.getByRole('button', { name: /start this room myself/i })).toBeInTheDocument();
  });

  it('gives a guest no host controls on any stage', () => {
    const revealed = stateWith({
      activeItemId: 'i1',
      revealed: true,
      items: [{ ...stateWith().items[0], status: 'revealed', votes: { p1: '5' } }],
    });
    render(<RoomView {...props({ role: 'guest', state: revealed })} />);
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-vote/i })).not.toBeInTheDocument();
    expect(screen.getByText(/the reveal/i)).toBeInTheDocument();
  });
});
